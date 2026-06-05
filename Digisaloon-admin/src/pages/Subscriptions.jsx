import { useState, useEffect, useRef } from "react";
import { db } from "../firebase-config";
import { collection, getDocs, doc, getDoc, updateDoc, addDoc } from "firebase/firestore";
import { 
  CheckCircle, Search, MapPin, Phone, 
  X, Loader2, Building2, Ticket, Users, Clock, Edit
} from "lucide-react";

export default function Subscriptions() {
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [founderPromo, setFounderPromo] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  // Dashboard Stats
  const [stats, setStats] = useState({
    active: 0,
    trial: 0,
    expiring: 0
  });

  // Modal States
  const [modalData, setModalData] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newExpiryDate, setNewExpiryDate] = useState("");

  // 1. FETCH DATA
  const loadData = async () => {
    setLoading(true);
    try {
      // A. Fetch Promo Details (Founder Trial Info)
      const promoRef = doc(db, "partner_promos", "FOUNDER03");
      const promoSnap = await getDoc(promoRef);
      let promoData = null;
      if (promoSnap.exists()) {
        promoData = promoSnap.data();
        setFounderPromo(promoData);
      }

      // B. Fetch All Partners
      const partnersSnap = await getDocs(collection(db, "partners"));
      
      let activeCount = 0;
      let trialCount = 0;
      let expiringCount = 0;

      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);

      const partnersList = partnersSnap.docs.map(docSnap => {
        const d = docSnap.data();
        const email = d.ownerInfo?.email || d.email || "";
        const name = d.salonName || d.basicInfo?.salonName || "Unknown Salon";
        
        let fullAddress = "Location not set";
        let rawArea = "Unknown"; 

        if (d.address && typeof d.address === 'object') {
            const { area, city, pincode } = d.address;
            rawArea = area || "Unknown";
            fullAddress = [area, city, pincode].filter(Boolean).join(", ");
        } else if (typeof d.address === 'string') {
            fullAddress = d.address;
            rawArea = "Misc"; 
        }

        // Check if on Trial
        const isTrial = promoData && promoData.usedBy && promoData.usedBy.includes(email);
        
        // Subscription Dates
        const validUntil = d.subscriptionValidUntil ? d.subscriptionValidUntil.toDate() : null;
        let isExpiringSoon = false;
        let status = "Inactive";
        let statusColor = "gray";

        if (d.subscriptionActive === true && validUntil) {
            status = "Active";
            statusColor = "green";
            activeCount++;

            if (isTrial) {
                trialCount++;
                status = "Free Trial";
                statusColor = "blue";
            }

            // Check if expiring within 7 days
            if (validUntil <= nextWeek && validUntil >= now) {
                isExpiringSoon = true;
                expiringCount++;
                status = "Expiring Soon";
                statusColor = "orange";
            } else if (validUntil < now) {
                status = "Expired";
                statusColor = "red";
                activeCount--; // Decrement if expired but boolean was true
            }
        }

        return {
          id: docSnap.id,
          name: name,
          email: email,
          phone: d.ownerInfo?.phone || d.phone || "N/A",
          address: fullAddress,
          area: rawArea,
          isTrial: isTrial,
          validUntil: validUntil,
          status: status,
          statusColor: statusColor,
          subscriptionType: d.subscriptionType || (isTrial ? `Founder (${promoData.trialMonths}M)` : "Not Set"),
          isExpiringSoon: isExpiringSoon
        };
      });

      setPartners(partnersList);
      setStats({ active: activeCount, trial: trialCount, expiring: expiringCount });

    } catch (error) { console.error("Error:", error); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openManageModal = (salon) => {
      // Set default date for input (YYYY-MM-DD format)
      let defaultDate = new Date();
      if(salon.validUntil) {
          defaultDate = new Date(salon.validUntil);
      } else {
          defaultDate.setMonth(defaultDate.getMonth() + 1); // Default +1 month
      }
      setNewExpiryDate(defaultDate.toISOString().split('T')[0]);
      setModalData(salon);
  };

  const handleUpdateSubscription = async () => {
      if (!modalData || !newExpiryDate) return;
      if (!window.confirm(`Update subscription for ${modalData.name}?`)) return;

      setIsUpdating(true);
      try {
          const newDateObj = new Date(newExpiryDate);
          newDateObj.setHours(23, 59, 59); // End of day

          // 1. Salon ka main status update karo
          await updateDoc(doc(db, "partners", modalData.id), {
              subscriptionActive: true,
              subscriptionValidUntil: newDateObj,
              subscriptionType: "Monthly"
          });

          // 2. 🔥 NAYA CODE: Billing Ledger mein record save karo
          await addDoc(collection(db, "partners", modalData.id, "subscription_history"), {
              salonName: modalData.name,
              planType: "Monthly", 
              amountPaid: 999, // 👈 Subscription ki fees yahan set kar lena (e.g. 999 ya 1499)
              activatedAt: new Date(),
              validUntil: newDateObj,
              paymentMethod: "Manual (Admin)",
              transactionId: "TXN" + Date.now().toString().slice(-6) // Random TXN ID generate hoga
          });

          alert("Subscription Updated & Billed Successfully! ✅");
          setModalData(null);
          loadData();
      } catch (error) {
          console.error(error);
          alert("Error updating subscription.");
      }
      setIsUpdating(false);
  };

  const filteredSalons = partners.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm);
    if (!matchesSearch) return false;

    if (activeTab === "all") return true;
    if (activeTab === "trial" && s.isTrial) return true;
    if (activeTab === "expiring" && s.isExpiringSoon) return true;
    
    return false;
  });

  return (
    <div className="p-8 bg-gray-50/50 min-h-screen relative">
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Subscriptions & Plans 📅</h1>
          <p className="text-sm text-gray-500 mt-1">Manage monthly rentals and founder trials.</p>
        </div>
        <button onClick={loadData} className="text-sm bg-white border px-4 py-2 rounded-lg hover:bg-gray-50 font-bold shadow-sm transition-all flex items-center gap-2">
            Refresh Data {loading && <Loader2 size={14} className="animate-spin"/>}
        </button>
      </div>

      {/* NEW STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto mb-10">
        <div className="bg-white p-6 rounded-2xl border border-green-100 shadow-sm flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
            <div>
                <p className="text-green-600 font-bold text-xs uppercase tracking-wider mb-1">Total Active Salons</p>
                <p className="text-3xl font-black text-gray-900">{stats.active}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-full text-green-500"><Building2 size={28}/></div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
            <div>
                <p className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">On Trial / Founders</p>
                <p className="text-3xl font-black text-gray-900">{stats.trial}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-full text-blue-500"><Ticket size={28}/></div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-orange-100 shadow-sm flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
            <div>
                <p className="text-orange-600 font-bold text-xs uppercase tracking-wider mb-1">Expiring Soon (7 Days)</p>
                <p className="text-3xl font-black text-gray-900">{stats.expiring}</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-full text-orange-500"><Clock size={28}/></div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-4 items-center bg-gray-50/30">
            <div className="flex bg-gray-200/60 p-1 rounded-xl">
                <button onClick={() => setActiveTab('all')} className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'all' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    <Users size={16}/> All Salons
                </button>
                <button onClick={() => setActiveTab('trial')} className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'trial' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    <Ticket size={16}/> Trials
                </button>
                <button onClick={() => setActiveTab('expiring')} className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'expiring' ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    <Clock size={16}/> Expiring
                </button>
            </div>
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input type="text" placeholder="Search Salon or Phone..." className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 w-full outline-none" onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider w-1/3">Salon Details</th>
                        <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Plan Type</th>
                        <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Status & Expiry</th>
                        <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredSalons.map((salon) => (
                        <tr key={salon.id} className="hover:bg-blue-50/10 transition-colors">
                            <td className="p-5">
                                <div className="flex flex-col gap-1.5">
                                    <div className="font-bold text-gray-900 text-lg">{salon.name}</div>
                                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                        <div className="flex items-center gap-1.5"><Phone size={14} className="text-gray-400"/><span className="font-medium text-gray-700">{salon.phone}</span></div>
                                        {salon.area !== "Unknown" && (
                                            <div className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">
                                                <MapPin size={10}/> {salon.area}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1 font-mono">{salon.id}</div>
                                </div>
                            </td>
                            
                            <td className="p-5 align-middle">
                                <div className="font-bold text-gray-700">{salon.subscriptionType}</div>
                                {salon.isTrial && <div className="text-[10px] text-blue-500 mt-1 font-bold tracking-wide uppercase">Promo Applied</div>}
                            </td>

                            <td className="p-5 align-middle">
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-${salon.statusColor}-100 text-${salon.statusColor}-700 border border-${salon.statusColor}-200`}>
                                    <span className={`w-1.5 h-1.5 rounded-full bg-${salon.statusColor}-500`}></span>
                                    {salon.status}
                                </div>
                                <div className="text-sm font-medium text-gray-600 mt-2">
                                    {salon.validUntil ? salon.validUntil.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "Not Set"}
                                </div>
                            </td>

                            <td className="p-5 text-right align-middle">
                                <button onClick={() => openManageModal(salon)} className="px-4 py-2 rounded-xl font-bold shadow-sm border border-gray-200 bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all inline-flex items-center gap-2">
                                    <Edit size={16}/> Manage
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* MANAGE SUBSCRIPTION MODAL */}
        {modalData && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Manage Subscription</h3>
                            <p className="text-sm text-gray-500">For <span className="font-bold">{modalData.name}</span></p>
                        </div>
                        <button onClick={() => setModalData(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={20}/></button>
                    </div>

                    <div className="p-6">
                        <div className="mb-5 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Current Status</p>
                            <p className="font-bold text-gray-800">{modalData.status} • Valid till {modalData.validUntil ? modalData.validUntil.toLocaleDateString() : "Not Set"}</p>
                            {modalData.isTrial && <p className="text-xs text-blue-600 mt-1 italic">This salon is using a Free Trial promo.</p>}
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Set New Expiry Date</label>
                            <input 
                                type="date" 
                                className="w-full p-3 border border-gray-300 rounded-xl text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                                value={newExpiryDate}
                                onChange={(e) => setNewExpiryDate(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-2">Setting a future date will mark the subscription as 'Active' and 'Monthly'.</p>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setModalData(null)} className="flex-1 py-3 font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
                            <button 
                                onClick={handleUpdateSubscription} 
                                disabled={isUpdating}
                                className="flex-[2] py-3 font-bold text-white rounded-xl shadow-lg flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 transition-all"
                            >
                                {isUpdating ? <Loader2 className="animate-spin"/> : <CheckCircle size={20}/>}
                                Update Plan
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}