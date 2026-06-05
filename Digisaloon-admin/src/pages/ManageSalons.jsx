import { useState, useEffect } from "react";
import { db, storage } from "../firebase-config";
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
    Store, MapPin, Phone, Search, Plus, Edit3, Trash2,
    Save, X, Loader2, List, Banknote, Copy, Clock, Layers, Link as LinkIcon,
    Briefcase, ShieldCheck, User, Scissors
} from "lucide-react";

export default function ManageSalons() {
    const [loading, setLoading] = useState(true);
    const [partners, setPartners] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

    // --- STATES FOR EDITING ---
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [activeTab, setActiveTab] = useState("details"); // 'details' | 'menu' | 'team'
    const [isSaving, setIsSaving] = useState(false);
    const [editFormData, setEditFormData] = useState(null);
    const [tempImageUrl, setTempImageUrl] = useState("");
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // --- STATES FOR SERVICES ---
    const [serviceList, setServiceList] = useState([]);
    const [isFetchingServices, setIsFetchingServices] = useState(false);
    const [newService, setNewService] = useState({ name: "", price: "", time: "30", gender: "Unisex", category: "Hair" });
    const [imageFile, setImageFile] = useState(null);
    const [hasVariants, setHasVariants] = useState(false);
    const [variantList, setVariantList] = useState([{ name: "", price: "", time: "30" }]);

    // 🔥 NEW: STATES FOR STYLIST TEAM
    const [newStylist, setNewStylist] = useState({ name: "", role: "" });
    const [stylistImageFile, setStylistImageFile] = useState(null);

    const CATEGORIES = ["Hair", "Beard", "Facial", "Massage", "Manicure", "Pedicure", "Waxing", "Threading", "Hair Color", "Bridal", "Skin Care", "Spa", "Other"];

    // --- STATES FOR ADDING SALON ---
    const [isAddingSalon, setIsAddingSalon] = useState(false);
    const [newSalonData, setNewSalonData] = useState({
        salonName: "", salonType: "Unisex", outletType: "Rent", branches: "0",
        ownerName: "", ownerPhone: "", ownerEmail: "",
        area: "", city: "Ranchi", pincode: "", mapsLink: "", latitude: "", longitude: "",
        openTime: "10:00 AM", closeTime: "08:00 PM", chairs: "2", weeklyOff: "Mon",
        gstNumber: "", panNumber: "",
        upiId: "", accountNumber: "", bankName: "", ifscCode: "",
        salonImage: ""
    });

    // 1. FETCH PARTNERS
    const fetchPartners = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "partners"));
            const list = querySnapshot.docs.map(doc => {
                const d = doc.data();
                const name = d.salonName || d.basicInfo?.salonName || "Unknown Salon";
                const phone = d.ownerInfo?.phone || d.phone || d.basicInfo?.ownerPhone || "N/A";

                let area = "Unknown Area";
                let city = "Ranchi";
                if (d.address) {
                    if (typeof d.address === 'object') {
                        area = d.address.area || "";
                        city = d.address.city || "Ranchi";
                    } else if (typeof d.address === 'string') area = d.address;
                }

                return {
                    id: doc.id,
                    ...d,
                    displayName: name,
                    displayPhone: phone,
                    displayArea: area,
                    displayCity: city
                };
            });
            setPartners(list);
        } catch (error) { console.error(error); }
        setLoading(false);
    };

    useEffect(() => { fetchPartners(); }, []);

    // 2. FETCH SERVICES
    const fetchServices = async (partnerId) => {
        setIsFetchingServices(true);
        try {
            const querySnapshot = await getDocs(collection(db, "partners", partnerId, "services_menu"));
            const services = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setServiceList(services);
        } catch (error) { console.error(error); }
        setIsFetchingServices(false);
    };

    useEffect(() => {
        if (selectedPartner) {
            setEditFormData({
                salonName: selectedPartner.basicInfo?.salonName || selectedPartner.salonName || "",
                salonType: selectedPartner.basicInfo?.salonType || "Unisex",
                outletType: selectedPartner.basicInfo?.outletType || "Rent",
                ownerName: selectedPartner.ownerInfo?.name || "",
                ownerPhone: selectedPartner.ownerInfo?.phone || selectedPartner.phone || "",
                ownerEmail: selectedPartner.ownerInfo?.email || "",
                area: selectedPartner.address?.area || (typeof selectedPartner.address === 'string' ? selectedPartner.address : ""),
                city: selectedPartner.address?.city || "Ranchi",
                pincode: selectedPartner.address?.pincode || "",
                mapsLink: selectedPartner.address?.mapsLink || "",
                latitude: selectedPartner.basicInfo?.latitude || selectedPartner.lat || "",
                longitude: selectedPartner.basicInfo?.longitude || selectedPartner.lng || "",
                images: selectedPartner.images || [], 
                team: selectedPartner.team || [], // 🔥 Fetch Team Array
                openTime: selectedPartner.operations?.openTime || "10:00 AM",
                closeTime: selectedPartner.operations?.closeTime || "08:00 PM",
                chairs: selectedPartner.operations?.chairs || "2",
                weeklyOff: selectedPartner.operations?.weeklyOff?.[0] || "Mon",
                gstNumber: selectedPartner.legal?.gstNumber || "",
                panNumber: selectedPartner.legal?.panNumber || "",
                upiId: selectedPartner.bankDetails?.upiId || "",
                accountNumber: selectedPartner.bankDetails?.accountNumber || "",
                bankName: selectedPartner.bankDetails?.bankName || "",
                ifscCode: selectedPartner.bankDetails?.ifscCode || ""
            });

            if (activeTab === 'menu') fetchServices(selectedPartner.id);
        }
    }, [selectedPartner, activeTab]);

    // 3. UPDATE DETAILS
    const handleUpdateDetails = async () => {
        if (!selectedPartner || !editFormData) return;
        setIsSaving(true);
        try {
            const docRef = doc(db, "partners", selectedPartner.id);
            const updatedData = {
                "basicInfo.salonName": editFormData.salonName,
                "basicInfo.salonType": editFormData.salonType,
                "basicInfo.outletType": editFormData.outletType,
                "ownerInfo.name": editFormData.ownerName,
                "ownerInfo.phone": editFormData.ownerPhone,
                "ownerInfo.email": editFormData.ownerEmail,
                "address.area": editFormData.area,
                "address.city": editFormData.city,
                "address.pincode": editFormData.pincode,
                "address.mapsLink": editFormData.mapsLink,
                "basicInfo.latitude": parseFloat(editFormData.latitude) || 0,
                "basicInfo.longitude": parseFloat(editFormData.longitude) || 0,
                "lat": parseFloat(editFormData.latitude) || 0,
                "lng": parseFloat(editFormData.longitude) || 0,
                "operations.openTime": editFormData.openTime,
                "operations.closeTime": editFormData.closeTime,
                "operations.chairs": editFormData.chairs,
                "operations.weeklyOff": [editFormData.weeklyOff],
                "legal.gstNumber": editFormData.gstNumber,
                "legal.panNumber": editFormData.panNumber,
                "legal.gstRegistered": editFormData.gstNumber ? "Yes" : "No",
                "bankDetails.upiId": editFormData.upiId,
                "bankDetails.accountNumber": editFormData.accountNumber,
                "bankDetails.bankName": editFormData.bankName,
                "bankDetails.ifscCode": editFormData.ifscCode,
                salonName: editFormData.salonName,
                images: editFormData.images || []
            };

            await updateDoc(docRef, updatedData);
            alert("Updated Successfully! ✅");
            fetchPartners();
        } catch (e) { console.error(e); alert("Update Failed ❌"); }
        setIsSaving(false);
    };

    const handleUploadSalonImage = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploadingImage(true);
        try {
            const imageRef = ref(storage, `salons/${Date.now()}_${file.name}`);
            const uploadResult = await uploadBytes(imageRef, file);
            const downloadUrl = await getDownloadURL(uploadResult.ref);

            setEditFormData(prev => ({
                ...prev,
                images: [...(prev.images || []), downloadUrl]
            }));
            e.target.value = null; 
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Failed to upload image. Please try again.");
        }
        setIsUploadingImage(false);
    };

    // SERVICE LOGIC
    const handleVariantChange = (index, field, value) => {
        const updated = [...variantList]; updated[index][field] = value; setVariantList(updated);
    };
    const addVariantRow = () => setVariantList([...variantList, { name: "", price: "", time: "30" }]);
    const removeVariantRow = (index) => setVariantList(variantList.filter((_, i) => i !== index));

    const handleAddService = async () => {
        if (!newService.name) return alert("Enter Service Name");
        setIsSaving(true);
        try {
            let finalImageUrl = "";
            if (imageFile) {
                const imageRef = ref(storage, `services/${Date.now()}_${imageFile.name}`);
                const uploadResult = await uploadBytes(imageRef, imageFile);
                finalImageUrl = await getDownloadURL(uploadResult.ref);
            }
            const payload = {
                name: newService.name, 
                gender: newService.gender, 
                category: newService.category,
                image: finalImageUrl,
                price: hasVariants ? "0" : newService.price.toString(),
                time: newService.time.toString(), 
                isCustomizable: hasVariants, 
                enabled: true,
                createdAt: new Date().toISOString(),
                variants: hasVariants ? variantList.map(v => ({ name: v.name, price: v.price.toString(), time: v.time.toString() })) : []
            };
            await addDoc(collection(db, "partners", selectedPartner.id, "services_menu"), payload);
            fetchServices(selectedPartner.id);
            setNewService({ name: "", price: "", time: "30", gender: "Unisex", category: "Hair" });
            setImageFile(null); 
            setHasVariants(false); 
            setVariantList([{ name: "", price: "", time: "30" }]);
        } catch (e) { alert("Failed to add service."); }
        setIsSaving(false);
    };

    const handleDeleteService = async (serviceId) => {
        if (!window.confirm("Delete this service?")) return;
        setIsSaving(true);
        try { await deleteDoc(doc(db, "partners", selectedPartner.id, "services_menu", serviceId)); fetchServices(selectedPartner.id); }
        catch (e) { alert("Failed to delete"); }
        setIsSaving(false);
    };

    // 🔥 NEW: STYLIST / TEAM LOGIC
    const handleAddStylist = async () => {
        if (!newStylist.name || !newStylist.role) return alert("Stylist Name and Role are required!");
        setIsSaving(true);
        try {
            let finalImageUrl = "";
            if (stylistImageFile) {
                const imageRef = ref(storage, `stylists/${Date.now()}_${stylistImageFile.name}`);
                const uploadResult = await uploadBytes(imageRef, stylistImageFile);
                finalImageUrl = await getDownloadURL(uploadResult.ref);
            }

            const newMember = {
                id: Date.now().toString(),
                name: newStylist.name,
                role: newStylist.role,
                image: finalImageUrl,
                addedAt: new Date().toISOString()
            };

            const updatedTeam = [...(editFormData.team || []), newMember];
            
            // Directly update Firestore document for team
            const docRef = doc(db, "partners", selectedPartner.id);
            await updateDoc(docRef, { team: updatedTeam });
            
            // Update local state
            setEditFormData({ ...editFormData, team: updatedTeam });
            setNewStylist({ name: "", role: "" });
            setStylistImageFile(null);
            document.getElementById('stylist-file-input').value = ''; // Reset input
            alert("Stylist Added Successfully! 🎉");

        } catch (e) { console.error(e); alert("Failed to add stylist."); }
        setIsSaving(false);
    };

    const handleDeleteStylist = async (stylistId) => {
        if (!window.confirm("Remove this stylist from the team?")) return;
        setIsSaving(true);
        try {
            const updatedTeam = editFormData.team.filter(s => s.id !== stylistId);
            const docRef = doc(db, "partners", selectedPartner.id);
            await updateDoc(docRef, { team: updatedTeam });
            setEditFormData({ ...editFormData, team: updatedTeam });
        } catch (e) { console.error(e); alert("Failed to remove stylist."); }
        setIsSaving(false);
    };

    // CREATE SALON LOGIC
    const handleCreateSalon = async () => {
        if (!newSalonData.salonName || !newSalonData.ownerPhone || !newSalonData.ownerEmail) return alert("Salon Name, Phone, and Email are required!");
        setIsSaving(true);
        try {
            const newDoc = {
                basicInfo: { salonName: newSalonData.salonName, salonType: newSalonData.salonType, outletType: newSalonData.outletType, branches: newSalonData.branches, latitude: parseFloat(newSalonData.latitude) || 0, longitude: parseFloat(newSalonData.longitude) || 0 }, 
                ownerInfo: { name: newSalonData.ownerName, phone: newSalonData.ownerPhone, email: newSalonData.ownerEmail, partnerId: Date.now().toString() },
                address: { area: newSalonData.area, city: newSalonData.city, pincode: newSalonData.pincode, mapsLink: newSalonData.mapsLink },
                lat: parseFloat(newSalonData.latitude) || 0, 
                lng: parseFloat(newSalonData.longitude) || 0, 
                operations: { openTime: newSalonData.openTime, closeTime: newSalonData.closeTime, chairs: newSalonData.chairs, weeklyOff: [newSalonData.weeklyOff], facilities: ["AC", "WiFi"] },
                legal: { gstRegistered: newSalonData.gstNumber ? "Yes" : "No", gstNumber: newSalonData.gstNumber, panNumber: newSalonData.panNumber },
                bankDetails: { upiId: newSalonData.upiId, accountNumber: newSalonData.accountNumber, ifscCode: newSalonData.ifscCode, bankName: newSalonData.bankName },
                images: newSalonData.salonImage ? [newSalonData.salonImage] : [],
                salonName: newSalonData.salonName, 
                isActive: true,          
                isLive: false,           
                isShopOpen: false,       
                verifiedByAdmin: false,  
                status: "pending",       
                isBlocked: false, 
                walletBalance: 0, 
                createdAt: new Date(), 
                team: [] // Initialize empty team array
            };
            
            await addDoc(collection(db, "partners"), newDoc);
            alert("Salon Created & Set to Pending Verification! ⏳");
            setIsAddingSalon(false);
            fetchPartners();
            setNewSalonData({ salonName: "", salonType: "Unisex", outletType: "Rent", branches: "0", ownerName: "", ownerPhone: "", ownerEmail: "", area: "", city: "Ranchi", pincode: "", mapsLink: "", latitude: "", longitude: "", openTime: "10:00 AM", closeTime: "08:00 PM", chairs: "2", weeklyOff: "Mon", gstNumber: "", panNumber: "", upiId: "", accountNumber: "", bankName: "", ifscCode: "", salonImage: "" });
        } catch (e) { console.error(e); alert("Creation Failed"); }
        setIsSaving(false);
    };

    const filteredPartners = partners.filter(p =>
        p.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.displayArea?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 bg-gray-50/50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Salon Directory 🏪</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage active salons, menus & bank details.</p>
                </div>
                <button onClick={() => setIsAddingSalon(true)} className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all">
                    <Plus size={18} /> Add Salon Manually
                </button>
            </div>

            <div className="max-w-7xl mx-auto mb-6 relative">
                <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input type="text" placeholder="Search Salon..." className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                    {filteredPartners.map(partner => (
                        <div key={partner.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 font-bold text-xl uppercase">{partner.displayName?.[0] || "S"}</div>
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${partner.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{partner.isActive !== false ? 'Active' : 'Inactive'}</span>
                                </div>
                                <h3 className="font-bold text-lg text-gray-900 mb-1">{partner.displayName}</h3>
                                <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-1"><MapPin size={14} /> {partner.displayArea}, {partner.displayCity}</p>
                                <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-4"><Phone size={14} /> {partner.displayPhone}</p>
                                <div className="flex gap-2 border-t border-gray-100 pt-4">
                                    <button onClick={() => { setSelectedPartner(partner); setActiveTab('details'); }} className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-bold flex items-center justify-center gap-2"><Edit3 size={16} /> Edit Info</button>
                                    <button onClick={() => { setSelectedPartner(partner); setActiveTab('menu'); }} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-bold flex items-center justify-center gap-2"><List size={16} /> Menu</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* CREATE SALON MODAL (Hidden for brevity, same as previous) */}
            {isAddingSalon && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-gray-800">Add New Salon</h2>
                            <button onClick={() => setIsAddingSalon(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} className="text-gray-500" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                {/* Basic Info */}
                                <div className="bg-white p-5 rounded-xl border border-gray-200">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Store size={18} className="text-blue-500" /> Basic Info</h3>
                                    <div className="space-y-3">
                                        <div><label className="text-xs font-bold text-gray-500">Salon Name*</label><input className="w-full p-2 border rounded-lg" value={newSalonData.salonName} onChange={e => setNewSalonData({ ...newSalonData, salonName: e.target.value })} /></div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="text-xs font-bold text-gray-500">Type</label><select className="w-full p-2 border rounded-lg" value={newSalonData.salonType} onChange={e => setNewSalonData({ ...newSalonData, salonType: e.target.value })}><option>Unisex</option><option>Male</option><option>Female</option></select></div>
                                            <div><label className="text-xs font-bold text-gray-500">Ownership</label><select className="w-full p-2 border rounded-lg" value={newSalonData.outletType} onChange={e => setNewSalonData({ ...newSalonData, outletType: e.target.value })}><option>Rent</option><option>Company Owned</option></select></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Owner & Location */}
                                <div className="bg-white p-5 rounded-xl border border-gray-200">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><User size={18} className="text-purple-500" /> Owner & Location</h3>
                                    <div className="space-y-3">
                                        <div><label className="text-xs font-bold text-gray-500">Owner Name</label><input className="w-full p-2 border rounded-lg" value={newSalonData.ownerName} onChange={e => setNewSalonData({ ...newSalonData, ownerName: e.target.value })} /></div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="text-xs font-bold text-gray-500">Phone*</label><input className="w-full p-2 border rounded-lg" value={newSalonData.ownerPhone} onChange={e => setNewSalonData({ ...newSalonData, ownerPhone: e.target.value })} /></div>
                                            <div><label className="text-xs font-bold text-gray-500">Email (For OTP)*</label><input type="email" placeholder="salon@gmail.com" className="w-full p-2 border rounded-lg" value={newSalonData.ownerEmail} onChange={e => setNewSalonData({ ...newSalonData, ownerEmail: e.target.value })} /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="text-xs font-bold text-gray-500">Area</label><input className="w-full p-2 border rounded-lg" value={newSalonData.area} onChange={e => setNewSalonData({ ...newSalonData, area: e.target.value })} /></div>
                                            <div><label className="text-xs font-bold text-gray-500">City</label><input className="w-full p-2 border rounded-lg" value={newSalonData.city} onChange={e => setNewSalonData({ ...newSalonData, city: e.target.value })} /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            <div><label className="text-xs font-bold text-gray-500">Pincode</label><input type="text" placeholder="834001" className="w-full p-2 border rounded-lg" value={newSalonData.pincode} onChange={e => setNewSalonData({ ...newSalonData, pincode: e.target.value })} /></div>
                                            <div><label className="text-xs font-bold text-gray-500">Maps Link</label><input type="text" placeholder="https://maps..." className="w-full p-2 border rounded-lg" value={newSalonData.mapsLink} onChange={e => setNewSalonData({ ...newSalonData, mapsLink: e.target.value })} /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            <div><label className="text-xs font-bold text-gray-500">Latitude</label><input type="number" placeholder="23.377" className="w-full p-2 border rounded-lg" value={newSalonData.latitude} onChange={e => setNewSalonData({ ...newSalonData, latitude: e.target.value })} /></div>
                                            <div><label className="text-xs font-bold text-gray-500">Longitude</label><input type="number" placeholder="85.331" className="w-full p-2 border rounded-lg" value={newSalonData.longitude} onChange={e => setNewSalonData({ ...newSalonData, longitude: e.target.value })} /></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Operations */}
                                <div className="bg-white p-5 rounded-xl border border-gray-200">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Clock size={18} className="text-orange-500" /> Operations</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-xs font-bold text-gray-500">Open Time</label><input className="w-full p-2 border rounded-lg" value={newSalonData.openTime} onChange={e => setNewSalonData({ ...newSalonData, openTime: e.target.value })} /></div>
                                        <div><label className="text-xs font-bold text-gray-500">Close Time</label><input className="w-full p-2 border rounded-lg" value={newSalonData.closeTime} onChange={e => setNewSalonData({ ...newSalonData, closeTime: e.target.value })} /></div>
                                        <div><label className="text-xs font-bold text-gray-500">Chairs</label><input className="w-full p-2 border rounded-lg" value={newSalonData.chairs} onChange={e => setNewSalonData({ ...newSalonData, chairs: e.target.value })} /></div>
                                        <div><label className="text-xs font-bold text-gray-500">Weekly Off</label><select className="w-full p-2 border rounded-lg" value={newSalonData.weeklyOff} onChange={e => setNewSalonData({ ...newSalonData, weeklyOff: e.target.value })}><option>Mon</option><option>Tue</option><option>Sun</option><option>None</option></select></div>
                                    </div>
                                </div>

                                {/* Legal & Bank */}
                                <div className="bg-white p-5 rounded-xl border border-gray-200">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-green-500" /> Legal & Bank</h3>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="text-xs font-bold text-gray-500">GST No.</label><input className="w-full p-2 border rounded-lg" value={newSalonData.gstNumber} onChange={e => setNewSalonData({ ...newSalonData, gstNumber: e.target.value })} /></div>
                                            <div><label className="text-xs font-bold text-gray-500">PAN No.</label><input className="w-full p-2 border rounded-lg" value={newSalonData.panNumber} onChange={e => setNewSalonData({ ...newSalonData, panNumber: e.target.value })} /></div>
                                        </div>
                                        <div><label className="text-xs font-bold text-gray-500">UPI ID</label><input className="w-full p-2 border rounded-lg" value={newSalonData.upiId} onChange={e => setNewSalonData({ ...newSalonData, upiId: e.target.value })} /></div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="text-xs font-bold text-gray-500">Account No.</label><input className="w-full p-2 border rounded-lg" value={newSalonData.accountNumber} onChange={e => setNewSalonData({ ...newSalonData, accountNumber: e.target.value })} /></div>
                                            <div><label className="text-xs font-bold text-gray-500">IFSC</label><input className="w-full p-2 border rounded-lg" value={newSalonData.ifscCode} onChange={e => setNewSalonData({ ...newSalonData, ifscCode: e.target.value })} /></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-white">
                            <button onClick={() => setIsAddingSalon(false)} className="px-6 py-3 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
                            <button onClick={handleCreateSalon} disabled={isSaving} className="px-8 py-3 font-bold text-white bg-black rounded-xl hover:bg-gray-800 flex items-center gap-2">{isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />} Create Salon</button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT / MENU / TEAM MODAL */}
            {selectedPartner && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex overflow-hidden">
                        
                        {/* SIDEBAR NAVIGATION */}
                        <div className="w-72 bg-gray-50 border-r border-gray-200 p-6 flex flex-col gap-2 shrink-0 overflow-y-auto">
                            <div className="mb-6">
                                <div className="h-16 w-16 bg-white border border-gray-200 rounded-full flex items-center justify-center text-2xl font-bold text-gray-400 shadow-sm mb-3">{selectedPartner.displayName?.[0]}</div>
                                <h2 className="font-bold text-gray-900 leading-tight">{selectedPartner.displayName}</h2>
                                <div className="mt-2 p-2 bg-gray-200 rounded text-[10px] font-mono break-all text-gray-600 select-all cursor-pointer hover:bg-gray-300" title="Click to copy" onClick={() => { navigator.clipboard.writeText(selectedPartner.id); alert("ID Copied!") }}>ID: {selectedPartner.id} <Copy size={10} className="inline ml-1" /></div>
                            </div>
                            <button onClick={() => setActiveTab('details')} className={`p-3 rounded-xl text-left text-sm font-bold flex items-center gap-3 transition-all ${activeTab === 'details' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}><Store size={18} /> Salon Details</button>
                            <button onClick={() => setActiveTab('menu')} className={`p-3 rounded-xl text-left text-sm font-bold flex items-center gap-3 transition-all ${activeTab === 'menu' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}><List size={18} /> Service Menu</button>
                            {/* 🔥 NEW TAB: STYLIST TEAM */}
                            <button onClick={() => setActiveTab('team')} className={`p-3 rounded-xl text-left text-sm font-bold flex items-center gap-3 transition-all ${activeTab === 'team' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}><Briefcase size={18} /> Stylist Team</button>
                        </div>

                        <div className="flex-1 flex flex-col h-full overflow-hidden">
                            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
                                <h3 className="text-xl font-bold text-gray-800">
                                    {activeTab === 'details' && 'Edit Salon Details'}
                                    {activeTab === 'menu' && 'Manage Services'}
                                    {activeTab === 'team' && 'Stylist Details'}
                                </h3>
                                <button onClick={() => setSelectedPartner(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} className="text-gray-500" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
                                
                                {/* ---------------- DETAILS TAB ---------------- */}
                                {activeTab === 'details' && editFormData && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                            {/* Manage Images Preview Gallery */}
                                            <div className="md:col-span-2 bg-gray-50/80 p-5 rounded-xl border border-gray-200 shadow-sm">
                                                <div className="flex justify-between items-center mb-3">
                                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Manage Images ({editFormData.images?.length || 0})</label>
                                                    <span className="text-[10px] text-gray-400 font-bold bg-white px-2 py-1 rounded border">Add multiple photos</span>
                                                </div>
                                                
                                                <div className="flex flex-col gap-4">
                                                    {editFormData.images && editFormData.images.length > 0 ? (
                                                        <div className="flex flex-wrap gap-3">
                                                            {editFormData.images.map((imgUrl, index) => (
                                                                <div key={index} className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-white shadow-md shrink-0 group">
                                                                    <img src={imgUrl} alt={`Salon ${index}`} className="w-full h-full object-cover" />
                                                                    <button 
                                                                        onClick={() => {
                                                                            const newImages = [...editFormData.images];
                                                                            newImages.splice(index, 1);
                                                                            setEditFormData({...editFormData, images: newImages});
                                                                        }}
                                                                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500 backdrop-blur-md transition-all"
                                                                        title="Remove Image"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white text-gray-400 text-xs font-bold">
                                                            No Images Added Yet
                                                        </div>
                                                    )}
                                                    
                                                    <div className="flex w-full gap-2 items-center mt-2">
                                                        <div className="relative flex-1">
                                                            <input 
                                                                type="file" 
                                                                accept="image/*"
                                                                onChange={handleUploadSalonImage}
                                                                disabled={isUploadingImage}
                                                                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-900 file:text-white hover:file:bg-black cursor-pointer disabled:opacity-50 transition-all"
                                                            />
                                                        </div>
                                                        {isUploadingImage && (
                                                            <div className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2.5 rounded-lg border border-blue-100 shadow-sm shrink-0">
                                                                <Loader2 size={16} className="animate-spin" /> Uploading...
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Basic Info */}
                                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Store size={18} className="text-blue-500" /> Basic Info</h4>
                                                <div className="space-y-3">
                                                    <div><label className="text-xs font-bold text-gray-500">Salon Name</label><input className="w-full p-2 border rounded-lg" value={editFormData.salonName} onChange={e => setEditFormData({ ...editFormData, salonName: e.target.value })} /></div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><label className="text-xs font-bold text-gray-500">Type</label><select className="w-full p-2 border rounded-lg" value={editFormData.salonType} onChange={e => setEditFormData({ ...editFormData, salonType: e.target.value })}><option>Unisex</option><option>Male</option><option>Female</option></select></div>
                                                        <div><label className="text-xs font-bold text-gray-500">Ownership</label><select className="w-full p-2 border rounded-lg" value={editFormData.outletType} onChange={e => setEditFormData({ ...editFormData, outletType: e.target.value })}><option>Rent</option><option>Company Owned</option></select></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Owner & Location */}
                                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><User size={18} className="text-purple-500" /> Owner & Location</h4>
                                                <div className="space-y-3">
                                                    <div><label className="text-xs font-bold text-gray-500">Owner Name</label><input className="w-full p-2 border rounded-lg" value={editFormData.ownerName} onChange={e => setEditFormData({ ...editFormData, ownerName: e.target.value })} /></div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><label className="text-xs font-bold text-gray-500">Phone</label><input className="w-full p-2 border rounded-lg" value={editFormData.ownerPhone} onChange={e => setEditFormData({ ...editFormData, ownerPhone: e.target.value })} /></div>
                                                        <div><label className="text-xs font-bold text-gray-500">Email</label><input type="email" className="w-full p-2 border rounded-lg" value={editFormData.ownerEmail} onChange={e => setEditFormData({ ...editFormData, ownerEmail: e.target.value })} /></div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><label className="text-xs font-bold text-gray-500">Area</label><input className="w-full p-2 border rounded-lg" value={editFormData.area} onChange={e => setEditFormData({ ...editFormData, area: e.target.value })} /></div>
                                                        <div><label className="text-xs font-bold text-gray-500">City</label><input className="w-full p-2 border rounded-lg" value={editFormData.city} onChange={e => setEditFormData({ ...editFormData, city: e.target.value })} /></div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 mt-3">
                                                        <div><label className="text-xs font-bold text-gray-500">Pincode</label><input type="text" placeholder="834001" className="w-full p-2 border rounded-lg" value={editFormData.pincode} onChange={e => setEditFormData({ ...editFormData, pincode: e.target.value })} /></div>
                                                        <div><label className="text-xs font-bold text-gray-500">Maps Link</label><input type="text" placeholder="https://maps..." className="w-full p-2 border rounded-lg" value={editFormData.mapsLink} onChange={e => setEditFormData({ ...editFormData, mapsLink: e.target.value })} /></div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 mt-3">
                                                        <div><label className="text-xs font-bold text-gray-500">Latitude</label><input type="number" placeholder="23.377" className="w-full p-2 border rounded-lg" value={editFormData.latitude} onChange={e => setEditFormData({ ...editFormData, latitude: e.target.value })} /></div>
                                                        <div><label className="text-xs font-bold text-gray-500">Longitude</label><input type="number" placeholder="85.331" className="w-full p-2 border rounded-lg" value={editFormData.longitude} onChange={e => setEditFormData({ ...editFormData, longitude: e.target.value })} /></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Operations */}
                                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Clock size={18} className="text-orange-500" /> Operations</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div><label className="text-xs font-bold text-gray-500">Open Time</label><input className="w-full p-2 border rounded-lg" value={editFormData.openTime} onChange={e => setEditFormData({ ...editFormData, openTime: e.target.value })} /></div>
                                                    <div><label className="text-xs font-bold text-gray-500">Close Time</label><input className="w-full p-2 border rounded-lg" value={editFormData.closeTime} onChange={e => setEditFormData({ ...editFormData, closeTime: e.target.value })} /></div>
                                                    <div><label className="text-xs font-bold text-gray-500">Chairs</label><input className="w-full p-2 border rounded-lg" value={editFormData.chairs} onChange={e => setEditFormData({ ...editFormData, chairs: e.target.value })} /></div>
                                                    <div><label className="text-xs font-bold text-gray-500">Weekly Off</label><select className="w-full p-2 border rounded-lg" value={editFormData.weeklyOff} onChange={e => setEditFormData({ ...editFormData, weeklyOff: e.target.value })}><option>Mon</option><option>Tue</option><option>Sun</option><option>None</option></select></div>
                                                </div>
                                            </div>

                                            {/* Legal & Bank */}
                                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-green-500" /> Legal & Bank</h4>
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><label className="text-xs font-bold text-gray-500">GST No.</label><input className="w-full p-2 border rounded-lg" value={editFormData.gstNumber} onChange={e => setEditFormData({ ...editFormData, gstNumber: e.target.value })} /></div>
                                                        <div><label className="text-xs font-bold text-gray-500">PAN No.</label><input className="w-full p-2 border rounded-lg" value={editFormData.panNumber} onChange={e => setEditFormData({ ...editFormData, panNumber: e.target.value })} /></div>
                                                    </div>
                                                    <div><label className="text-xs font-bold text-gray-500">UPI ID</label><input className="w-full p-2 border rounded-lg" value={editFormData.upiId} onChange={e => setEditFormData({ ...editFormData, upiId: e.target.value })} /></div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><label className="text-xs font-bold text-gray-500">Account No.</label><input className="w-full p-2 border rounded-lg" value={editFormData.accountNumber} onChange={e => setEditFormData({ ...editFormData, accountNumber: e.target.value })} /></div>
                                                        <div><label className="text-xs font-bold text-gray-500">IFSC</label><input className="w-full p-2 border rounded-lg" value={editFormData.ifscCode} onChange={e => setEditFormData({ ...editFormData, ifscCode: e.target.value })} /></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-end">
                                            <button onClick={handleUpdateDetails} disabled={isSaving} className="px-8 py-3 font-bold text-white bg-gray-900 rounded-xl hover:bg-black flex items-center gap-2 shadow-lg">{isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />} Save All Changes</button>
                                        </div>
                                    </div>
                                )}

                                {/* ---------------- MENU TAB ---------------- */}
                                {activeTab === 'menu' && (
                                    <div className="space-y-6">
                                        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-bold text-blue-900 flex items-center gap-2"><Plus size={18} /> Add New Service</h4>
                                                <button onClick={() => { setHasVariants(!hasVariants); setVariantList([{ name: "", price: "", time: "30" }]); }} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${hasVariants ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300'}`}>
                                                    {hasVariants ? "Variants Enabled" : "Enable Variants?"}
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start mb-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Service Name</label>
                                                    <input type="text" placeholder="e.g. Hair Spa" className="w-full p-2.5 rounded-lg border border-blue-200 outline-none" value={newService.name} onChange={e => setNewService({ ...newService, name: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Service Photo (Upload)</label>
                                                    <input type="file" accept="image/*" className="w-full p-2 rounded-lg border border-blue-200 text-sm bg-white file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer" onChange={(e) => setImageFile(e.target.files[0])} />
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <label className="text-[10px] font-bold text-blue-500 uppercase mb-2 block">Category</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {CATEGORIES.map(cat => (
                                                        <button 
                                                            key={cat}
                                                            onClick={() => setNewService({...newService, category: cat})}
                                                            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${newService.category === cat ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                                        >
                                                            {cat}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {!hasVariants && (
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div><label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Standard Price (₹)</label><input type="number" placeholder="150" className="w-full p-2.5 rounded-lg border border-blue-200 outline-none" value={newService.price} onChange={e => setNewService({ ...newService, price: e.target.value })} /></div>
                                                    <div><label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Time (Mins)</label><input type="number" placeholder="30" className="w-full p-2.5 rounded-lg border border-blue-200 outline-none" value={newService.time} onChange={e => setNewService({ ...newService, time: e.target.value })} /></div>
                                                </div>
                                            )}

                                            {hasVariants && (
                                                <div className="bg-white p-3 rounded-xl border border-blue-100 mb-3">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Service Variants</label>
                                                    {variantList.map((v, index) => (
                                                        <div key={index} className="flex gap-2 mb-2 items-center">
                                                            <input type="text" placeholder="Name (e.g. Gold)" className="flex-1 p-2 text-sm border rounded-lg bg-gray-50" value={v.name} onChange={(e) => handleVariantChange(index, 'name', e.target.value)} />
                                                            <input type="number" placeholder="Price" className="w-20 p-2 text-sm border rounded-lg bg-gray-50" value={v.price} onChange={(e) => handleVariantChange(index, 'price', e.target.value)} />
                                                            <div className="relative w-20">
                                                                <Clock size={12} className="absolute left-2 top-3 text-gray-400" />
                                                                <input type="number" placeholder="Min" className="w-full pl-6 p-2 text-sm border rounded-lg bg-gray-50" value={v.time} onChange={(e) => handleVariantChange(index, 'time', e.target.value)} />
                                                            </div>
                                                            {variantList.length > 1 && <button onClick={() => removeVariantRow(index)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>}
                                                        </div>
                                                    ))}
                                                    <button onClick={addVariantRow} className="text-xs text-blue-600 font-bold hover:underline">+ Add Another Variant</button>
                                                </div>
                                            )}

                                            <button onClick={handleAddService} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg font-bold flex justify-center items-center shadow-md transition-all">
                                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />} Save Service
                                            </button>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                            <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-gray-500 text-xs uppercase tracking-wider flex justify-between">
                                                <span>Current Menu ({serviceList.length || 0} items)</span>
                                            </div>
                                            <div className="divide-y divide-gray-100">
                                                {isFetchingServices ? (
                                                    <div className="p-8 text-center flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
                                                ) : serviceList.length === 0 ? (
                                                    <div className="p-8 text-center text-gray-400 italic">No services found.</div>
                                                ) : (
                                                    serviceList.map((service) => (
                                                        <div key={service.id} className="p-4 hover:bg-gray-50 group transition-colors">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 overflow-hidden border">
                                                                        {service.image ? (
                                                                            <img src={service.image} alt="Service" className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            service.isCustomizable ? <Layers size={20} /> : <Store size={20} />
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <h5 className="font-bold text-gray-900">{service.name || service.serviceName}</h5>
                                                                        <div className="flex gap-2 text-xs mt-1">
                                                                            {service.category && (
                                                                                <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium border border-red-100">{service.category}</span>
                                                                            )}
                                                                            {!service.isCustomizable && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock size={10} /> {service.time}m</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-6">
                                                                    {service.isCustomizable ? (
                                                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">{service.variants?.length} Variants</span>
                                                                    ) : (
                                                                        <span className="font-bold text-gray-900 text-lg">₹{service.price}</span>
                                                                    )}
                                                                    <button onClick={() => handleDeleteService(service.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg" title="Delete"><Trash2 size={18} /></button>
                                                                </div>
                                                            </div>
                                                            {service.isCustomizable && service.variants && (
                                                                <div className="mt-3 ml-16 bg-gray-50 rounded-lg p-3 border border-gray-100 text-sm">
                                                                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Options Available</p>
                                                                    {service.variants.map((v, idx) => (
                                                                        <div key={idx} className="flex justify-between py-1 border-b border-gray-200 last:border-0">
                                                                            <span className="text-gray-700 font-medium">{v.name}</span>
                                                                            <div className="flex gap-3">
                                                                                <span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={10} /> {v.time}m</span>
                                                                                <span className="font-bold text-gray-900">₹{v.price}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 🔥 ---------------- TEAM TAB (NEW) ---------------- */}
                                {activeTab === 'team' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><User size={18} className="text-blue-500"/> Add New Staff</h4>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Full Name</label>
                                                    <input type="text" placeholder="e.g. Rahul Mahto" className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" value={newStylist.name} onChange={e => setNewStylist({ ...newStylist, name: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Specialization (Role)</label>
                                                    <input type="text" placeholder="e.g. Barber / Makeup Artist" className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" value={newStylist.role} onChange={e => setNewStylist({ ...newStylist, role: e.target.value })} />
                                                </div>
                                            </div>
                                            
                                            <div className="mb-4">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Stylist Photo (Optional)</label>
                                                <input id="stylist-file-input" type="file" accept="image/*" className="w-full p-2 rounded-lg border border-gray-200 text-sm bg-gray-50 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer" onChange={(e) => setStylistImageFile(e.target.files[0])} />
                                            </div>

                                            <button onClick={handleAddStylist} disabled={isSaving} className="w-full bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-lg font-bold flex justify-center items-center shadow-md transition-all">
                                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />} Add to Team
                                            </button>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                            <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-gray-500 text-xs uppercase tracking-wider flex justify-between">
                                                <span>Current Stylists ({(editFormData?.team || []).length} members)</span>
                                            </div>
                                            <div className="divide-y divide-gray-100">
                                                {!(editFormData?.team) || editFormData.team.length === 0 ? (
                                                    <div className="p-10 text-center text-gray-400 italic">No stylists found. Add your team!</div>
                                                ) : (
                                                    editFormData.team.map((stylist) => (
                                                        <div key={stylist.id} className="p-4 hover:bg-gray-50 flex items-center justify-between group transition-colors">
                                                            <div className="flex items-center gap-4">
                                                                <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 overflow-hidden border-2 border-white shadow-sm">
                                                                    {stylist.image ? (
                                                                        <img src={stylist.image} alt={stylist.name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <User size={20} />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h5 className="font-bold text-gray-900">{stylist.name}</h5>
                                                                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                                                        <Scissors size={12} /> {stylist.role}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => handleDeleteStylist(stylist.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg transition-colors" title="Remove Stylist">
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}