import { useState, useEffect } from "react";
import { db } from "../firebase-config";
import { collection, getDocs, collectionGroup, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { 
  Calendar, Clock, User, Search, CheckCircle, XCircle, AlertCircle, Scissors, 
  Store, ChevronRight, ArrowLeft, TrendingUp, Wallet, Map, Copy, Footprints, 
  CalendarCheck, Radio, MessageCircle, RotateCcw, Smartphone, Banknote, Download, CheckSquare
} from "lucide-react";

export default function Bookings() {
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [groupedByArea, setGroupedByArea] = useState({});
  
  const [view, setView] = useState("areas");
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedSalonId, setSelectedSalonId] = useState(null);
  const [selectedSalonName, setSelectedSalonName] = useState("");
  
  const [areaSearch, setAreaSearch] = useState("");
  const [salonSearch, setSalonSearch] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming");
  const [dateFilter, setDateFilter] = useState("all"); 
  const [customDate, setCustomDate] = useState("");

  // 1. FETCH PARTNERS
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const snapshot = await getDocs(collection(db, "partners"));
        const data = snapshot.docs.map(doc => {
          const d = doc.data();
          const areaName = typeof d.address === 'object' ? d.address.area : d.address?.split(',')[0] || "Other";
          return { id: doc.id, ...d, name: d.salonName || d.basicInfo?.salonName || "Unknown Salon", area: areaName.trim() };
        });
        setPartners(data);
      } catch (error) { console.error(error); }
    };
    fetchPartners();
  }, []);

  // 2. REAL-TIME BOOKINGS
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collectionGroup(db, "bookings"), (snapshot) => {
      const bookingData = snapshot.docs.map(doc => {
        const raw = doc.data();
        let serviceDisplay = "Service Info";
        if (raw.serviceName && typeof raw.serviceName === 'string') serviceDisplay = raw.serviceName;
        else if (raw.service && typeof raw.service === 'string') serviceDisplay = raw.service;
        else if (Array.isArray(raw.services) && raw.services.length > 0) {
            serviceDisplay = raw.services.map(s => typeof s === 'object' ? (s.name || s.serviceName) : s).join(", ");
        }

        return {
          id: doc.id,
          refPath: doc.ref.path, 
          ...raw,
          userName: raw.userName || raw.customerName || raw.name || "Guest",
          userPhone: raw.userPhone || raw.phone || "No Phone",
          serviceName: serviceDisplay,
          salonId: doc.ref.parent.parent?.id || "NOT_LINKED",
          totalAmount: Number(raw.totalAmount || raw.price || 0),
          adminCommission: Number(raw.adminCommission || 0),
          commissionStatus: raw.commissionStatus || "pending",
          paymentMethod: raw.paymentMethod || "Pay at Salon",
          status: raw.status || "pending",
          isLiveBooking: raw.isLive === true,
          bookingType: raw.isWalkIn === true ? "Walk-in" : "Scheduled",
          parsedDate: raw.date ? new Date(raw.date) : new Date(),
          cancelReason: raw.cancellationReason || raw.rejectionReason || "No reason"
        };
      });
      setAllBookings(bookingData);
      setLoading(false);
    });
    return () => unsubscribe(); 
  }, []);

  // 3. GROUPING LOGIC
  useEffect(() => {
    if (partners.length === 0) return;
    const areaGroup = {};
    partners.forEach(partner => {
      const area = partner.area;
      const salonBookings = allBookings.filter(b => b.salonId === partner.id && checkDateFilter(b));
      
      if (!areaGroup[area]) areaGroup[area] = { areaName: area, totalRevenue: 0, totalBookings: 0, salons: [] };

      const salonStats = {
        id: partner.id,
        name: partner.name,
        totalBookings: salonBookings.length,
        totalRevenue: salonBookings.reduce((sum, b) => sum + b.totalAmount, 0),
        pending: salonBookings.filter(b => b.status === 'pending').length
      };

      areaGroup[area].salons.push(salonStats);
      areaGroup[area].totalRevenue += salonStats.totalRevenue;
      areaGroup[area].totalBookings += salonStats.totalBookings;
    });
    setGroupedByArea(areaGroup);
  }, [allBookings, partners, dateFilter, customDate]);

  // HELPERS
  const checkDateFilter = (booking) => {
    if (dateFilter === 'all') return true;
    const d1 = booking.parsedDate;
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const isSame = (a, b) => a.toDateString() === b.toDateString();

    if (dateFilter === 'today') return isSame(d1, today);
    if (dateFilter === 'yesterday') return isSame(d1, yesterday);
    if (dateFilter === 'month') return d1.getMonth() === today.getMonth() && d1.getFullYear() === today.getFullYear();
    if (dateFilter === 'custom' && customDate) return isSame(d1, new Date(customDate));
    return true;
  };

  // 🔥 NEW: Toggle Commission Status (Pending <-> Paid)
  const toggleCommission = async (booking) => {
      if(booking.bookingType === "Walk-in") return; // Walk-ins have 0 commission
      const newStatus = booking.commissionStatus === 'paid' ? 'pending' : 'paid';
      if(!window.confirm(`Mark commission as ${newStatus.toUpperCase()}?`)) return;
      try {
          await updateDoc(doc(db, booking.refPath), { commissionStatus: newStatus });
      } catch(e) { console.error(e); }
  };

  const handleStatusUpdate = async (path, status) => {
    let reason = "";
    if (status === 'cancelled') {
        reason = prompt("Reason for cancellation:");
        if (!reason) return;
    } else if (!confirm(`Mark as ${status}?`)) return;

    try {
        await updateDoc(doc(db, path), status === 'cancelled' ? { status, cancellationReason: reason } : { status });
    } catch(e) { console.error(e); }
  };

  // --- UI COMPONENTS ---
  const getCommissionBadge = (booking) => {
      if(booking.bookingType === "Walk-in") return <div className="text-gray-400 text-xs">-</div>;
      
      const isPaid = booking.commissionStatus === 'paid';
      return (
          <div onClick={() => toggleCommission(booking)} className={`cursor-pointer select-none flex flex-col items-center border rounded px-2 py-1 ${isPaid ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
              <span className="font-bold text-gray-800 text-sm">₹{booking.adminCommission}</span>
              <span className={`text-[9px] font-bold uppercase ${isPaid ? "text-green-700" : "text-orange-600"}`}>
                  {isPaid ? "PAID ✅" : "PENDING ⏳"}
              </span>
          </div>
      );
  };

  const getFilteredBookings = () => {
      return allBookings
        .filter(b => b.salonId === selectedSalonId && checkDateFilter(b))
        .filter(b => b.userName?.toLowerCase().includes(bookingSearch.toLowerCase()) || b.serviceName?.toLowerCase().includes(bookingSearch.toLowerCase()))
        .filter(b => {
            const s = b.status.toLowerCase();
            if (activeTab === "upcoming") return s === 'pending' || s === 'confirmed';
            if (activeTab === "completed") return s === 'completed' || s === 'done';
            return s === 'cancelled' || s === 'rejected';
        });
  };

  // 🔥 NEW: Calculate Stats for the current view
  const currentStats = () => {
      const books = getFilteredBookings();
      const revenue = books.reduce((sum, b) => sum + b.totalAmount, 0);
      const commission = books.reduce((sum, b) => sum + (b.bookingType !== 'Walk-in' ? b.adminCommission : 0), 0);
      return { revenue, commission, count: books.length };
  };

  return (
    <div className="p-8 bg-gray-50/50 min-h-screen">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6 max-w-7xl mx-auto">
         <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                {view === 'areas' ? 'Overview 📍' : view === 'salons' ? 'Salons 🏠' : 'Bookings 📅'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Real-time operations dashboard.</p>
         </div>
         <div className="flex flex-wrap items-center bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm gap-2">
            {[{id: 'all', label: 'All'}, {id: 'today', label: 'Today'}, {id: 'yesterday', label: 'Yesterday'}, {id: 'month', label: 'Month'}].map((f) => (
                <button key={f.id} onClick={() => {setDateFilter(f.id); setCustomDate("");}} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${dateFilter === f.id ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}>{f.label}</button>
            ))}
            <input type="date" value={customDate} onChange={(e) => { setCustomDate(e.target.value); setDateFilter('custom'); }} className={`text-xs font-bold p-1.5 rounded-lg outline-none cursor-pointer border-l pl-2 ${dateFilter === 'custom' ? "text-blue-700" : "text-gray-500"}`}/>
         </div>
      </div>

      {/* VIEW 1 & 2 (AREAS / SALONS) - Kept same logic, hidden for brevity in this final snippet if unmodified, else include full */}
      {view !== 'details' && (
        <div className="max-w-7xl mx-auto">
            {/* Search Bar Logic for Levels 1 & 2 */}
            <div className="flex justify-between items-center mb-8 gap-4">
                {view === 'salons' && <button onClick={() => setView("areas")} className="bg-white border p-2.5 rounded-full hover:bg-gray-50 shadow-sm"><ArrowLeft size={20}/></button>}
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" placeholder={view === 'areas' ? "Search Area..." : "Search Salon..."} className="pl-10 pr-4 py-2.5 border rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-500/50" 
                        onChange={(e) => view === 'areas' ? setAreaSearch(e.target.value) : setSalonSearch(e.target.value)} />
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(view === 'areas' ? Object.values(groupedByArea).filter(a => a.areaName.toLowerCase().includes(areaSearch.toLowerCase())) 
                 : selectedArea?.salons.filter(s => s.name.toLowerCase().includes(salonSearch.toLowerCase()) || s.id.toLowerCase().includes(salonSearch.toLowerCase())))
                 ?.map((item, idx) => (
                    <div key={idx} onClick={() => { 
                        if(view === 'areas') { setSelectedArea(item); setView("salons"); } 
                        else { setSelectedSalonId(item.id); setSelectedSalonName(item.name); setView("details"); }
                    }} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer group hover:shadow-lg hover:-translate-y-1 transition-all">
                        <div className="flex justify-between items-center mb-6">
                            <div className="bg-blue-50 text-blue-700 p-3.5 rounded-xl">{view === 'areas' ? <Map size={26}/> : <Store size={26}/>}</div>
                            <ChevronRight className="text-gray-300 group-hover:text-blue-600"/>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{view === 'areas' ? item.areaName : item.name}</h3>
                        <p className="text-sm text-gray-500 mb-6">{view === 'areas' ? `${item.salons.length} Salons` : `ID: ${item.id.slice(0,12)}...`}</p>
                        <div className="flex gap-8 border-t pt-6">
                            <div><p className="text-xs font-bold text-gray-400 uppercase">Bookings</p><p className="text-2xl font-bold text-gray-800">{item.totalBookings}</p></div>
                            <div><p className="text-xs font-bold text-gray-400 uppercase">Revenue</p><p className="text-2xl font-bold text-emerald-600">₹{item.totalRevenue.toLocaleString()}</p></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* 📄 VIEW 3: DETAILS TABLE WITH SUMMARY */}
      {view === 'details' && (
        <div className="max-w-7xl mx-auto animate-in slide-in-from-right-4">
            
            {/* 🔥 NEW: SUMMARY CARDS FOR ADMIN */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-white p-5 rounded-2xl border border-blue-100 shadow-sm">
                    <p className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">Total Revenue</p>
                    <p className="text-3xl font-black text-gray-900">₹{currentStats().revenue.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-white p-5 rounded-2xl border border-purple-100 shadow-sm">
                    <p className="text-purple-600 font-bold text-xs uppercase tracking-wider mb-1">My Commission</p>
                    <p className="text-3xl font-black text-gray-900">₹{currentStats().commission.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Total Bookings</p>
                    <p className="text-3xl font-black text-gray-900">{currentStats().count}</p>
                </div>
            </div>

            {/* CONTROLS */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView("salons")} className="bg-white border p-2.5 rounded-full hover:bg-gray-50 shadow-sm"><ArrowLeft size={20}/></button>
                    <div><h1 className="text-2xl font-bold text-gray-900">{selectedSalonName}</h1><p className="text-xs font-mono text-gray-500 uppercase">UID: {selectedSalonId}</p></div>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    <input type="text" placeholder="Search..." className="pl-10 pr-4 py-3 border rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm text-sm" onChange={(e) => setBookingSearch(e.target.value)} />
                </div>
            </div>

            <div className="flex gap-6 mb-6 border-b">
                {["upcoming", "completed", "cancelled"].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 px-2 text-sm font-bold capitalize border-b-2 transition-all ${activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400"}`}>{tab}</button>
                ))}
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>{['Service', 'Customer', 'Time', 'Payment', 'Comm.', 'Amount', 'Status', 'Actions'].map(h => <th key={h} className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {getFilteredBookings().map(booking => (
                            <tr key={booking.id} className="hover:bg-blue-50/20 transition-colors">
                                <td className="p-4">
                                    <div className="font-bold text-gray-900 flex items-center gap-2"><Scissors size={14} className="text-blue-500"/> {String(booking.serviceName)}</div>
                                    <div className="text-[10px] text-gray-400 mt-1 font-mono">ID: {booking.id}</div>
                                </td>
                                <td className="p-4">
                                    <div className="font-bold text-gray-800 text-sm">{booking.userName}</div>
                                    <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                                        {booking.userPhone}
                                        {booking.userPhone !== "No Phone" && <a href={`https://wa.me/${booking.userPhone.replace(/\D/g,'')}`} target="_blank" className="text-green-500 hover:scale-110 ml-1"><MessageCircle size={14}/></a>}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col gap-1">
                                        {booking.isLiveBooking ? <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold w-fit animate-pulse">LIVE</span> 
                                         : <span className={`text-[10px] px-2 py-0.5 rounded font-bold w-fit border ${booking.bookingType === 'Walk-in' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{booking.bookingType}</span>}
                                        <div className="text-xs text-gray-500 font-medium mt-1">{booking.date} <br/> {booking.time}</div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded border flex items-center gap-1 w-fit ${booking.paymentMethod === 'Pay at Salon' ? 'bg-gray-100 text-gray-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                        {booking.paymentMethod === 'Pay at Salon' ? <Store size={10}/> : <Smartphone size={10}/>} 
                                        {booking.paymentMethod === 'Pay at Salon' ? 'Paid at Salon' : 'Paid on DigiSalon'}
                                    </span>
                                </td>
                                {/* 🔥 Commission with Click-to-Settle */}
                                <td className="p-4">{getCommissionBadge(booking)}</td>
                                <td className="p-4 font-black text-gray-900">₹{booking.totalAmount}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold border ${booking.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : booking.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                        {booking.status.toUpperCase()}
                                    </span>
                                    {booking.cancelReason !== "No reason" && <div className="text-[10px] text-red-500 mt-1 italic max-w-[100px] leading-tight">"{booking.cancelReason}"</div>}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        {booking.status === 'pending' && <>
                                            <button onClick={() => handleStatusUpdate(booking.refPath, 'confirmed')} className="p-1.5 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100"><CheckCircle size={14}/></button>
                                            <button onClick={() => handleStatusUpdate(booking.refPath, 'cancelled')} className="p-1.5 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100"><XCircle size={14}/></button>
                                        </>}
                                        {booking.status === 'confirmed' && <>
                                            <button onClick={() => handleStatusUpdate(booking.refPath, 'completed')} className="p-1.5 bg-green-50 text-green-600 rounded border border-green-200 hover:bg-green-100"><CheckCircle size={14}/></button>
                                            <button onClick={() => handleStatusUpdate(booking.refPath, 'cancelled')} className="p-1.5 bg-gray-50 text-gray-600 rounded border border-gray-200 hover:bg-gray-100"><XCircle size={14}/></button>
                                        </>}
                                        {booking.status === 'completed' && <button onClick={() => handleStatusUpdate(booking.refPath, 'confirmed')} className="p-1.5 bg-orange-50 text-orange-600 rounded border border-orange-200 hover:bg-orange-100"><RotateCcw size={14}/></button>}
                                        {booking.status === 'cancelled' && <button onClick={() => handleStatusUpdate(booking.refPath, 'pending')} className="p-1.5 bg-gray-50 text-gray-600 rounded border border-gray-200 hover:bg-gray-100"><RotateCcw size={14}/></button>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {getFilteredBookings().length === 0 && <div className="p-12 text-center text-gray-400">No bookings match the filter.</div>}
            </div>
        </div>
      )}
    </div>
  );
}