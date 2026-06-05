import { useState, useEffect } from "react";
import { db } from "../firebase-config";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import {
  CheckCircle, XCircle, Search, MapPin, Phone,
  RotateCcw, Copy, Eye, X, Pencil, Save, Trash2, Plus, Ban, AlertCircle
} from "lucide-react";

export default function Partners() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedPartner, setSelectedPartner] = useState(null);
  const [editingPartner, setEditingPartner] = useState(null);
  const [editForm, setEditForm] = useState({
    area: "", city: "", pincode: "", mapsLink: "",
    latitude: "", longitude: "",
    salonType: "", outletType: "", branches: "", source: "",
    openTime: "", closeTime: "", chairs: "", weeklyOff: [], facilities: [],
    team: [],
    newFacility: "", newTeamName: "", newTeamRole: ""
  });

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "partners"));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPartners(data);
    } catch (error) { console.error("Error:", error); }
    setLoading(false);
  };

  useEffect(() => { fetchPartners(); }, []);

  const pendingCount = partners.filter(p => String(p.status || "pending").toLowerCase().includes("pending")).length;
  const verifiedCount = partners.filter(p => p.status === "verified").length;
  const rejectedCount = partners.filter(p => p.status === "rejected").length;

  const handleApprove = async (id) => {
    if (!window.confirm("Approve this partner?")) return;
    try {
      await updateDoc(doc(db, "partners", id), { status: "verified", verifiedByAdmin: true, isLive: true, isActive: true });
      fetchPartners();
    } catch (error) { console.error(error); }
  };

  const handleReject = async (id) => {
    const reason = window.prompt("Reason for rejection:");
    if (!reason) return;
    try {
      // 🚨 ALREADY FIXED: isActive false ho raha hai taaki user app se hide ho jaye
      await updateDoc(doc(db, "partners", id), { status: "rejected", isLive: false, isActive: false, rejectionReason: reason });
      fetchPartners();
    } catch (error) { console.error(error); }
  };

  const handleToggleBlock = async (id, currentIsActive) => {
    const newStatus = !currentIsActive;
    const actionText = newStatus ? "UNBLOCK and show in User App" : "BLOCK and hide from User App";

    if (!window.confirm(`Are you sure you want to ${actionText}?`)) return;

    try {
      await updateDoc(doc(db, "partners", id), { isActive: newStatus });
      fetchPartners();
    } catch (error) { console.error(error); }
  };

  const handleRestore = async (id) => {
    if (!window.confirm("Restore to Pending?")) return;
    try {
      await updateDoc(doc(db, "partners", id), { status: "pending", verifiedByAdmin: false, isLive: false, isActive: false });
      fetchPartners();
    } catch (error) { console.error(error); }
  };

  const openEditModal = (partner) => {
    setEditingPartner(partner);
    setEditForm({
      salonName: partner.salonName || partner.basicInfo?.salonName || "",
      ownerName: partner.ownerInfo?.name || partner.name || "",
      phone: partner.phone || partner.ownerInfo?.phone || "",
      email: partner.email || partner.ownerInfo?.email || "",

      area: typeof partner.address === 'object' ? partner.address?.area || "" : partner.address || "",
      city: partner.address?.city || "",
      pincode: partner.address?.pincode || "",
      mapsLink: partner.address?.mapsLink || "",

      latitude: partner.basicInfo?.latitude || partner.lat || "",
      longitude: partner.basicInfo?.longitude || partner.lng || "",

      salonType: partner.basicInfo?.salonType || "",
      outletType: partner.basicInfo?.outletType || "",
      branches: partner.basicInfo?.branches || "",
      source: partner.source || "",

      openTime: partner.operations?.openTime || "",
      closeTime: partner.operations?.closeTime || "",
      chairs: partner.operations?.chairs || "",
      weeklyOff: partner.operations?.weeklyOff || [],
      facilities: partner.operations?.facilities || [],

      panNumber: partner.legal?.panNumber || "",
      gstNumber: partner.legal?.gstNumber || "",
      bankName: partner.bankDetails?.bankName || "",
      accountNumber: partner.bankDetails?.accountNumber || "",
      ifscCode: partner.bankDetails?.ifscCode || "",
      images: partner.images || [],
      services: partner.services || [],
      team: partner.team || [],
      newService: "", newFacility: "", newTeamName: "", newTeamRole: ""
    });
  };

  const removeFacility = (idx) => setEditForm({ ...editForm, facilities: editForm.facilities.filter((_, i) => i !== idx) });
  const addFacility = () => { if (editForm.newFacility.trim()) setEditForm({ ...editForm, facilities: [...editForm.facilities, editForm.newFacility], newFacility: "" }) };

  const removeTeamMember = (idx) => setEditForm({ ...editForm, team: editForm.team.filter((_, i) => i !== idx) });
  const addTeamMember = () => {
    if (editForm.newTeamName.trim() && editForm.newTeamRole.trim()) {
      setEditForm({
        ...editForm,
        team: [...editForm.team, { id: Date.now().toString(), name: editForm.newTeamName, role: editForm.newTeamRole }],
        newTeamName: "", newTeamRole: ""
      });
    }
  };

  const removeImage = (indexToRemove) => {
    const updatedImages = editForm.images.filter((_, index) => index !== indexToRemove);
    setEditForm({ ...editForm, images: updatedImages });
  };

  const removeService = (indexToRemove) => {
    const updatedServices = editForm.services.filter((_, index) => index !== indexToRemove);
    setEditForm({ ...editForm, services: updatedServices });
  };

  const addService = () => {
    if (editForm.newService.trim() !== "") {
      setEditForm({
        ...editForm,
        services: [...editForm.services, editForm.newService],
        newService: ""
      });
    }
  };

  const handleUpdatePartner = async () => {
    if (!editingPartner) return;
    try {
      await updateDoc(doc(db, "partners", editingPartner.id), {
        "salonName": editForm.salonName,
        "basicInfo.salonName": editForm.salonName,
        "basicInfo.salonType": editForm.salonType,
        "basicInfo.outletType": editForm.outletType,
        "basicInfo.branches": editForm.branches,

        "ownerInfo.name": editForm.ownerName,
        "ownerInfo.phone": editForm.phone,
        "phone": editForm.phone,
        "ownerInfo.email": editForm.email,
        "email": editForm.email,

        "address.area": editForm.area,
        "address.city": editForm.city,
        "address.pincode": editForm.pincode,
        "address.mapsLink": editForm.mapsLink,

        "basicInfo.latitude": parseFloat(editForm.latitude) || 0,
        "basicInfo.longitude": parseFloat(editForm.longitude) || 0,
        "lat": parseFloat(editForm.latitude) || 0,
        "lng": parseFloat(editForm.longitude) || 0,

        "operations.openTime": editForm.openTime,
        "operations.closeTime": editForm.closeTime,
        "operations.chairs": editForm.chairs,
        "operations.weeklyOff": editForm.weeklyOff,
        "operations.facilities": editForm.facilities,

        "legal.panNumber": editForm.panNumber,
        "legal.gstNumber": editForm.gstNumber,
        "bankDetails.bankName": editForm.bankName,
        "bankDetails.accountNumber": editForm.accountNumber,
        "bankDetails.ifscCode": editForm.ifscCode,
        "images": editForm.images,
        "services": editForm.services,
        "team": editForm.team,
        "source": editForm.source
      });
      alert("Updated successfully! ✅");
      setEditingPartner(null);
      fetchPartners();
    } catch (error) {
      console.error("Error updating:", error);
      alert("Update failed!");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Copied: " + text);
  };

  const filteredPartners = partners.filter(partner => {
    const status = String(partner.status || "pending").toLowerCase();
    const name = String(partner.salonName || partner.basicInfo?.salonName || partner.ownerInfo?.name || "").toLowerCase();

    if (activeTab === "pending" && !status.includes("pending")) return false;
    if (activeTab === "verified" && status !== "verified") return false;
    if (activeTab === "rejected" && status !== "rejected") return false;

    return name.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-6 relative">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-gray-800">Partner Management</h1>
        <button onClick={fetchPartners} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-black transition-all">Refresh 🔄</button>
      </div>

      <div className="mb-6 relative w-full md:w-1/3">
        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
        <input type="text" placeholder="Search by Salon Name..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm" onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="flex gap-4 mb-6 border-b border-gray-200 pb-1">
        <button onClick={() => setActiveTab("pending")} className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === "pending" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Pending <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "pending" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>{pendingCount}</span>
        </button>
        <button onClick={() => setActiveTab("verified")} className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === "verified" ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Verified <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "verified" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{verifiedCount}</span>
        </button>
        <button onClick={() => setActiveTab("rejected")} className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === "rejected" ? "border-red-600 text-red-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Rejected <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "rejected" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>{rejectedCount}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> :
          filteredPartners.length === 0 ? <div className="p-12 text-center text-gray-400"><Search size={48} className="mx-auto mb-3 opacity-20" /><p>No partners found.</p></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-4 font-semibold text-gray-600 w-1/5">Salon Details</th>
                    <th className="p-4 font-semibold text-gray-600 w-1/6">Contact</th>
                    <th className="p-4 font-semibold text-gray-600 w-1/4">Status</th>
                    <th className="p-4 font-semibold text-right text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPartners.map((partner) => {
                    const displayName = partner.salonName || partner.basicInfo?.salonName || "Unknown Salon";
                    const displayPhone = partner.phone || partner.ownerInfo?.phone || "No Phone";

                    // 🚨 THE FIX: Agar data purana hai aur isActive missing hai, toh default 'true' manega
                    const isAppActive = partner.isActive !== false;

                    return (
                      <tr key={partner.id} className={`hover:bg-gray-50 transition-colors align-top ${!isAppActive && activeTab === 'verified' ? 'opacity-60 bg-gray-50' : ''}`}>
                        <td className="p-4">
                          <div className="font-bold text-gray-800 text-lg">{displayName}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded border border-gray-200 font-mono">ID: {partner.id.slice(0, 6)}...</div>
                            <button onClick={() => copyToClipboard(partner.id)} className="text-gray-400 hover:text-blue-600"><Copy size={14} /></button>
                          </div>
                        </td>
                        <td className="p-4 text-gray-600">
                          <div className="flex items-center gap-2 mb-1"><Phone size={14} /> {displayPhone}</div>
                          <div className="text-xs text-gray-400">{partner.address?.area || partner.address || "No Area"}</div>
                        </td>
                        <td className="p-4">
                          {activeTab === "verified" ? (
                            isAppActive ?
                              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex w-fit items-center gap-1"><CheckCircle size={12} /> Active</span> :
                              <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-bold flex w-fit items-center gap-1" title="Hidden from User App"><Ban size={12} /> Blocked</span>
                          ) : activeTab === "rejected" ? (
                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold flex w-fit items-center gap-1"><XCircle size={12} /> Rejected</span>
                          ) : (
                            String(partner.status || "pending").toLowerCase().includes("pending") ?
                              <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex w-fit items-center gap-1"><AlertCircle size={12} /> Pending</span> :
                              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold capitalize">Incomplete Form</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => openEditModal(partner)} className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200 border border-gray-300 transition-all" title="Edit"><Pencil size={18} /></button>
                            <button onClick={() => setSelectedPartner(partner)} className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100 border border-blue-200 transition-all" title="View"><Eye size={18} /></button>

                            {activeTab === "pending" && (
                              <>
                                <button onClick={() => handleApprove(partner.id)} className="bg-green-50 text-green-600 p-2 rounded-lg hover:bg-green-100 border border-green-200" title="Approve"><CheckCircle size={18} /></button>
                                <button onClick={() => handleReject(partner.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 border border-red-200" title="Reject"><XCircle size={18} /></button>
                              </>
                            )}

                            {/* 🚨 THE FIX: Distinct Block / Unblock Buttons with Text */}
                            {activeTab === "verified" && (
                              <button
                                onClick={() => handleToggleBlock(partner.id, isAppActive)}
                                className={`px-3 py-2 flex items-center gap-2 rounded-lg border transition-all shadow-sm ${isAppActive
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200'
                                    : 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200'
                                  }`}
                                title={isAppActive ? "Block Salon" : "Unblock Salon"}
                              >
                                {isAppActive ? (
                                  <><Ban size={16} /><span className="text-xs font-bold tracking-wide">BLOCK</span></>
                                ) : (
                                  <><CheckCircle size={16} /><span className="text-xs font-bold tracking-wide">UNBLOCK</span></>
                                )}
                              </button>
                            )}

                            {activeTab === "rejected" && (
                              <button onClick={() => handleRestore(partner.id)} className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200 border border-gray-300" title="Restore"><RotateCcw size={18} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {selectedPartner && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-2xl font-black text-gray-800">Salon Details</h2>
              <button onClick={() => setSelectedPartner(null)} className="p-2 bg-white rounded-full hover:bg-gray-200 transition-all shadow-sm"><X size={24} /></button>
            </div>
            <div className="p-8 overflow-y-auto flex-1 space-y-8">
              <section>
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">📸 Salon Images</h3>
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {(selectedPartner.images || []).map((img, index) => (
                    <img key={index} src={img} alt="Salon" className="h-32 w-48 object-cover rounded-xl border border-gray-200 shadow-sm shrink-0" />
                  ))}
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <section className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <h3 className="text-lg font-bold text-blue-800 mb-4">👤 Owner & Contact</h3>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-bold text-gray-600">Name:</span> {selectedPartner.ownerInfo?.name || selectedPartner.name || "N/A"}</p>
                    <p><span className="font-bold text-gray-600">Phone:</span> {selectedPartner.ownerInfo?.phone || selectedPartner.phone || "N/A"}</p>
                    <p><span className="font-bold text-gray-600">Email:</span> {selectedPartner.ownerInfo?.email || selectedPartner.email || "N/A"}</p>
                    <p><span className="font-bold text-gray-600">Address:</span> {selectedPartner.address?.area || ""}, {selectedPartner.address?.city || ""} - {selectedPartner.address?.pincode || ""}</p>
                    {selectedPartner.address?.mapsLink && (
                      <p><span className="font-bold text-gray-600">Location:</span> <a href={selectedPartner.address.mapsLink} target="_blank" rel="noreferrer" className="text-blue-600 underline hover:text-blue-800">Google Maps Link</a></p>
                    )}
                  </div>
                </section>

                <section className="bg-purple-50 p-6 rounded-2xl border border-purple-100">
                  <h3 className="text-lg font-bold text-purple-800 mb-4">🏪 Business Details</h3>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-bold text-gray-600">Salon Type:</span> {selectedPartner.basicInfo?.salonType || "N/A"}</p>
                    <p><span className="font-bold text-gray-600">Outlet Type:</span> {selectedPartner.basicInfo?.outletType || "N/A"}</p>
                    <p><span className="font-bold text-gray-600">Branches:</span> {selectedPartner.basicInfo?.branches || "N/A"}</p>
                    <p><span className="font-bold text-gray-600">Lead Source:</span> {selectedPartner.source || "N/A"}</p>
                  </div>
                </section>

                <section className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
                  <h3 className="text-lg font-bold text-orange-800 mb-4">⚙️ Operations</h3>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-bold text-gray-600">Timings:</span> {selectedPartner.operations?.openTime || "N/A"} to {selectedPartner.operations?.closeTime || "N/A"}</p>
                    <p><span className="font-bold text-gray-600">Total Chairs:</span> {selectedPartner.operations?.chairs || "N/A"}</p>
                    <p><span className="font-bold text-gray-600">Weekly Off:</span> {selectedPartner.operations?.weeklyOff?.join(', ') || "None"}</p>
                    <p><span className="font-bold text-gray-600">Facilities:</span> {selectedPartner.operations?.facilities?.join(', ') || "N/A"}</p>
                  </div>
                </section>

                <section className="bg-green-50 p-6 rounded-2xl border border-green-100">
                  <h3 className="text-lg font-bold text-green-800 mb-4">🏦 Legal & Bank</h3>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-bold text-gray-600">GST Registered:</span> {selectedPartner.legal?.gstRegistered || "N/A"}</p>
                    <p><span className="font-bold text-gray-600">GST No:</span> {selectedPartner.legal?.gstNumber || "N/A"}</p>
                    <p><span className="font-bold text-gray-600">PAN No:</span> {selectedPartner.legal?.panNumber || "N/A"}</p>
                    <div className="border-t border-green-200 my-2 pt-2">
                      <p><span className="font-bold text-gray-600">Bank:</span> {selectedPartner.bankDetails?.bankName || "N/A"}</p>
                      <p><span className="font-bold text-gray-600">Acc No:</span> {selectedPartner.bankDetails?.accountNumber || "N/A"}</p>
                      <p><span className="font-bold text-gray-600">IFSC:</span> {selectedPartner.bankDetails?.ifscCode || "N/A"}</p>
                    </div>
                  </div>
                </section>

                <section className="bg-teal-50 p-6 rounded-2xl border border-teal-100">
                  <h3 className="text-lg font-bold text-teal-800 mb-4">👥 Team Members</h3>
                  {selectedPartner.team && selectedPartner.team.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                      {selectedPartner.team.map((member, idx) => (
                        <li key={idx}><span className="font-bold">{member.name}</span> <span className="text-gray-500">({member.role})</span></li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400 italic text-sm">No team members added.</p>
                  )}
                </section>

                <section className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">✂️ Services Offered</h3>
                  <div className="flex flex-wrap gap-2">
                    {(selectedPartner.services || []).map((service, idx) => (
                      <span key={idx} className="bg-white text-gray-700 px-3 py-1 rounded-full text-sm font-medium border border-gray-300 shadow-sm">{service}</span>
                    ))}
                    {(!selectedPartner.services || selectedPartner.services.length === 0) && <p className="text-gray-400 italic">No services listed.</p>}
                  </div>
                </section>
              </div>

              {selectedPartner.status === "rejected" && selectedPartner.rejectionReason && (
                <section className="bg-red-50 p-6 rounded-2xl border border-red-100">
                  <h3 className="text-lg font-bold text-red-800 mb-2">❌ Rejection Reason</h3>
                  <p className="text-red-700 italic">"{selectedPartner.rejectionReason}"</p>
                </section>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setSelectedPartner(null)} className="px-6 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-200 transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      {editingPartner && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><Pencil size={20} /> Edit Details</h2>
              <button onClick={() => setEditingPartner(null)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Manage Images</label>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {editForm.images.length === 0 && <p className="text-sm text-gray-400">No images.</p>}
                  {editForm.images.map((img, index) => (
                    <div key={index} className="relative shrink-0 group">
                      <img src={img} className="h-24 w-32 object-cover rounded-lg border border-gray-300" />
                      <button onClick={() => removeImage(index)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-gray-800 border-b pb-1">👤 Basic Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Salon Name" value={editForm.salonName} onChange={(e) => setEditForm({ ...editForm, salonName: e.target.value })} className="p-3 border rounded-lg w-full" />
                  <input type="text" placeholder="Owner Name" value={editForm.ownerName} onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })} className="p-3 border rounded-lg w-full" />
                  <input type="text" placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="p-3 border rounded-lg w-full" />
                  <input type="email" placeholder="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="p-3 border rounded-lg w-full" />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <input type="text" placeholder="Area" value={editForm.area} onChange={(e) => setEditForm({ ...editForm, area: e.target.value })} className="p-3 border rounded-lg w-full" />
                  <input type="text" placeholder="City" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="p-3 border rounded-lg w-full" />
                  <input type="text" placeholder="Pincode" value={editForm.pincode} onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })} className="p-3 border rounded-lg w-full" />
                  <input type="text" placeholder="Maps Link" value={editForm.mapsLink} onChange={(e) => setEditForm({ ...editForm, mapsLink: e.target.value })} className="p-3 border rounded-lg w-full" />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <input type="text" placeholder="Latitude (e.g. 23.377161)" value={editForm.latitude} onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })} className="p-3 border rounded-lg w-full bg-blue-50/50" />
                  <input type="text" placeholder="Longitude (e.g. 85.3315048)" value={editForm.longitude} onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })} className="p-3 border rounded-lg w-full bg-blue-50/50" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-gray-800 border-b pb-1">⚙️ Operations & Business</h3>
                <div className="grid grid-cols-3 gap-4">
                  <input type="text" placeholder="Opening Time" value={editForm.openTime} onChange={(e) => setEditForm({ ...editForm, openTime: e.target.value })} className="p-3 border rounded-lg w-full" />
                  <input type="text" placeholder="Closing Time" value={editForm.closeTime} onChange={(e) => setEditForm({ ...editForm, closeTime: e.target.value })} className="p-3 border rounded-lg w-full" />
                  <input type="number" placeholder="Chairs" value={editForm.chairs} onChange={(e) => setEditForm({ ...editForm, chairs: e.target.value })} className="p-3 border rounded-lg w-full" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-gray-800 border-b pb-1">🏦 Bank & Legal</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="PAN" value={editForm.panNumber} onChange={(e) => setEditForm({ ...editForm, panNumber: e.target.value })} className="p-3 border rounded-lg w-full" />
                  <input type="text" placeholder="GST" value={editForm.gstNumber} onChange={(e) => setEditForm({ ...editForm, gstNumber: e.target.value })} className="p-3 border rounded-lg w-full" />
                  <input type="text" placeholder="Bank" value={editForm.bankName} onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })} className="p-3 border rounded-lg w-full" />
                  <input type="text" placeholder="IFSC" value={editForm.ifscCode} onChange={(e) => setEditForm({ ...editForm, ifscCode: e.target.value })} className="p-3 border rounded-lg w-full" />
                </div>
                <input type="text" placeholder="Account Number" value={editForm.accountNumber} onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })} className="p-3 border rounded-lg w-full" />
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-gray-800 border-b pb-1">👥 Manage Team</h3>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editForm.team.map((member, index) => (
                    <span key={index} className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-sm font-medium border border-teal-200 flex items-center gap-1">
                      {member.name} ({member.role})
                      <button onClick={() => removeTeamMember(index)} className="hover:text-red-600"><X size={14} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Staff Name" value={editForm.newTeamName} onChange={(e) => setEditForm({ ...editForm, newTeamName: e.target.value })} className="p-2 border rounded-lg flex-1" />
                  <input type="text" placeholder="Role (e.g. Hair)" value={editForm.newTeamRole} onChange={(e) => setEditForm({ ...editForm, newTeamRole: e.target.value })} className="p-2 border rounded-lg flex-1" />
                  <button onClick={addTeamMember} className="bg-teal-600 text-white p-2 rounded-lg"><Plus size={20} /></button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-gray-800 border-b pb-1">✂️ Services</h3>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editForm.services.map((service, index) => (
                    <span key={index} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium border border-gray-200 flex items-center gap-1">
                      {service}
                      <button onClick={() => removeService(index)} className="hover:text-red-600"><X size={14} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Add Service..." value={editForm.newService} onChange={(e) => setEditForm({ ...editForm, newService: e.target.value })} className="p-2 border rounded-lg flex-1" />
                  <button onClick={addService} className="bg-gray-800 text-white p-2 rounded-lg"><Plus size={20} /></button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setEditingPartner(null)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg">Cancel</button>
              <button onClick={handleUpdatePartner} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2">
                <Save size={18} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}