import { useState, useEffect } from "react";
import { db } from "../firebase-config"; 
import { collection, getDocs, collectionGroup, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { 
  Calendar, Clock, User, Search, CheckCircle, XCircle, AlertCircle, Scissors, 
  Store, ChevronRight, ArrowLeft, TrendingUp, Wallet, Map, Copy, Footprints, 
  CalendarCheck, Radio, MessageCircle, RotateCcw, Smartphone, Banknote, Download, CheckSquare,
  Eye, X, CreditCard, FileText, Activity, Info
} from "lucide-react";

// 🔥 YAHAN LOGO IMPORT KIYA HAI 🔥
import logoImage from '../assets/logo1.png';

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

  // Drawer, Invoice aur Pagination states
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const toggleCommission = async (booking) => {
      if(booking.bookingType === "Walk-in") return; 
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

  const formatTimestamp = (ts) => {
      if (!ts) return "—";
      try {
          const date = ts.toDate ? ts.toDate() : new Date(ts);
          return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch(e) { return "—"; }
  };

  // Filter, Sort and Pagination Logic
  const getFilteredBookings = () => {
      let filtered = allBookings
        .filter(b => b.salonId === selectedSalonId && checkDateFilter(b))
        .filter(b => b.userName?.toLowerCase().includes(bookingSearch.toLowerCase()) || b.serviceName?.toLowerCase().includes(bookingSearch.toLowerCase()))
        .filter(b => {
            const s = b.status.toLowerCase();
            if (activeTab === "upcoming") return s === 'pending' || s === 'confirmed';
            if (activeTab === "completed") return s === 'completed' || s === 'done';
            return s === 'cancelled' || s === 'rejected';
        });

      filtered.sort((a, b) => {
          const getTime = (dateVal) => {
              if (!dateVal) return 0;
              if (dateVal.toDate) return dateVal.toDate().getTime();
              return new Date(dateVal).getTime() || 0;
          };
          return getTime(b.createdAt) - getTime(a.createdAt); 
      });

      return filtered;
  };

  const currentStats = () => {
      const books = getFilteredBookings();
      const revenue = books.reduce((sum, b) => sum + b.totalAmount, 0);
      const commission = books.reduce((sum, b) => sum + (b.bookingType !== 'Walk-in' ? b.adminCommission : 0), 0);
      return { revenue, commission, count: books.length };
  };

  const paginatedBookings = getFilteredBookings().slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(getFilteredBookings().length / itemsPerPage);

  return (
    <div className="p-8 bg-gray-50/50 min-h-screen relative">
      
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
                <button key={f.id} onClick={() => {setDateFilter(f.id); setCustomDate(""); setCurrentPage(1);}} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${dateFilter === f.id ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}>{f.label}</button>
            ))}
            <input type="date" value={customDate} onChange={(e) => { setCustomDate(e.target.value); setDateFilter('custom'); setCurrentPage(1); }} className={`text-xs font-bold p-1.5 rounded-lg outline-none cursor-pointer border-l pl-2 ${dateFilter === 'custom' ? "text-blue-700" : "text-gray-500"}`}/>
         </div>
      </div>

      {/* VIEW 1 & 2 (AREAS / SALONS) */}
      {view !== 'details' && (
        <div className="max-w-7xl mx-auto">
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
                        else { setSelectedSalonId(item.id); setSelectedSalonName(item.name); setView("details"); setCurrentPage(1); }
                    }} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer group hover:shadow-lg hover:-translate-y-1 transition-all overflow-hidden flex flex-col justify-between">
                        
                        <div>
                          <div className="flex justify-between items-center mb-6">
                              <div className="bg-blue-50 text-blue-700 p-3.5 rounded-xl shrink-0">{view === 'areas' ? <Map size={26}/> : <Store size={26}/>}</div>
                              <ChevronRight className="text-gray-300 group-hover:text-blue-600 shrink-0"/>
                          </div>
                         {/* 🔥 truncate hata kar line-clamp-3 aur break-all lagaya 🔥 */}
<h3 className="text-xl font-bold text-gray-900 mb-1 line-clamp-3 break-all w-full" title={view === 'areas' ? item.areaName : item.name}>{view === 'areas' ? item.areaName : item.name}</h3>
                          <p className="text-sm text-gray-500 mb-6 truncate w-full" title={view === 'areas' ? `${item.salons.length} Salons` : `ID: ${item.id}`}>{view === 'areas' ? `${item.salons.length} Salons` : `ID: ${item.id.slice(0,12)}...`}</p>
                        </div>

                        <div className="flex gap-8 border-t pt-6 mt-auto">
                            <div><p className="text-xs font-bold text-gray-400 uppercase">Bookings</p><p className="text-2xl font-bold text-gray-800">{item.totalBookings}</p></div>
                            <div><p className="text-xs font-bold text-gray-400 uppercase">Revenue</p><p className="text-2xl font-bold text-emerald-600 break-all" title={`₹${item.totalRevenue.toLocaleString()}`}>₹{item.totalRevenue.toLocaleString()}</p></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* 📄 VIEW 3: DETAILS TABLE WITH PAGINATION */}
      {view === 'details' && (
        <div className="max-w-7xl mx-auto animate-in slide-in-from-right-4">
            
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

            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                    <button onClick={() => setView("salons")} className="bg-white border p-2.5 rounded-full hover:bg-gray-50 shadow-sm shrink-0"><ArrowLeft size={20}/></button>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-gray-900 truncate block" title={selectedSalonName}>{selectedSalonName}</h1>
                        <p className="text-xs font-mono text-gray-500 uppercase">UID: {selectedSalonId}</p>
                    </div>
                </div>
                <div className="relative w-full md:w-80 shrink-0">
                    <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    <input type="text" placeholder="Search..." className="pl-10 pr-4 py-3 border rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm text-sm" onChange={(e) => {setBookingSearch(e.target.value); setCurrentPage(1);}} />
                </div>
            </div>

            <div className="flex gap-6 mb-6 border-b">
                {["upcoming", "completed", "cancelled"].map(tab => (
                    <button 
                        key={tab} 
                        onClick={() => { setActiveTab(tab); setCurrentPage(1); }} 
                        className={`pb-3 px-2 text-sm font-bold capitalize border-b-2 transition-all ${activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400"}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left table-auto min-w-[1000px]">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>{['Service', 'Customer', 'Time', 'Amount', 'Status', 'Actions'].map(h => <th key={h} className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {paginatedBookings.map(booking => (
                                <tr key={booking.id} className="hover:bg-blue-50/20 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900 flex items-center gap-2">
                                            <Scissors size={14} className="text-blue-500 shrink-0"/> 
                                            <span className="whitespace-nowrap">
                                                {Array.isArray(booking.services) && booking.services.length > 0 
                                                    ? `${booking.services.length} Service${booking.services.length > 1 ? 's' : ''}` 
                                                    : "1 Service"}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-1 font-mono">ID: {booking.id}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-gray-800 text-sm">{booking.userName}</div>
                                        <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                                            {booking.userPhone}
                                            {booking.userPhone !== "No Phone" && <a href={`https://wa.me/${booking.userPhone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-green-500 hover:scale-110 ml-1"><MessageCircle size={14}/></a>}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            {booking.isLiveBooking ? <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold w-fit animate-pulse">LIVE</span> 
                                             : <span className={`text-[10px] px-2 py-0.5 rounded font-bold w-fit border ${booking.bookingType === 'Walk-in' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{booking.bookingType}</span>}
                                            <div className="text-xs text-gray-500 font-medium mt-1 whitespace-nowrap">{booking.date} <br/> {booking.time}</div>
                                        </div>
                                    </td>
                                    <td className="p-4 font-black text-gray-900">₹{booking.totalAmount}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold border ${booking.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : booking.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                            {booking.status.toUpperCase()}
                                        </span>
                                        {booking.cancelReason !== "No reason" && <div className="text-[10px] text-red-500 mt-1 italic max-w-[120px] line-clamp-2">"{booking.cancelReason}"</div>}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2 items-center">
                                            <button onClick={() => setSelectedBooking(booking)} className="p-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 hover:bg-gray-200" title="View Full Details">
                                                <Eye size={14}/>
                                            </button>
                                            
                                            {booking.status === 'pending' && <>
                                                <button onClick={() => handleStatusUpdate(booking.refPath, 'confirmed')} className="p-1.5 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100" title="Confirm"><CheckCircle size={14}/></button>
                                                <button onClick={() => handleStatusUpdate(booking.refPath, 'cancelled')} className="p-1.5 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100" title="Cancel"><XCircle size={14}/></button>
                                            </>}
                                            {booking.status === 'confirmed' && <>
                                                <button onClick={() => handleStatusUpdate(booking.refPath, 'completed')} className="p-1.5 bg-green-50 text-green-600 rounded border border-green-200 hover:bg-green-100" title="Complete"><CheckCircle size={14}/></button>
                                                <button onClick={() => handleStatusUpdate(booking.refPath, 'cancelled')} className="p-1.5 bg-gray-50 text-gray-600 rounded border border-gray-200 hover:bg-gray-100" title="Cancel"><XCircle size={14}/></button>
                                            </>}
                                            {booking.status === 'completed' && <button onClick={() => handleStatusUpdate(booking.refPath, 'confirmed')} className="p-1.5 bg-orange-50 text-orange-600 rounded border border-orange-200 hover:bg-orange-100" title="Revert to Confirmed"><RotateCcw size={14}/></button>}
                                            {booking.status === 'cancelled' && <button onClick={() => handleStatusUpdate(booking.refPath, 'pending')} className="p-1.5 bg-gray-50 text-gray-600 rounded border border-gray-200 hover:bg-gray-100" title="Revert to Pending"><RotateCcw size={14}/></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {getFilteredBookings().length === 0 && <div className="p-12 text-center text-gray-400">No bookings match the filter.</div>}
                
                {getFilteredBookings().length > itemsPerPage && (
                    <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
                        <p className="text-xs text-gray-500 font-medium">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, getFilteredBookings().length)} of {getFilteredBookings().length} bookings
                        </p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                                disabled={currentPage === 1}
                                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-2 text-sm font-bold text-gray-700 flex items-center">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                                disabled={currentPage >= totalPages}
                                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* =========================================
          RIGHT DETAIL DRAWER (BOOKING DETAILS)
      ========================================= */}
      {selectedBooking && (
        <>
            <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px]" onClick={() => setSelectedBooking(null)} />
            <div className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[480px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300">
                
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 bg-gray-50">
                    <div>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Booking Details</p>
                        <h2 className="text-lg font-bold text-slate-800 font-mono break-all leading-tight">#{selectedBooking.id}</h2>
                        <p className="mt-1 text-xs text-slate-500">Created: {formatTimestamp(selectedBooking.createdAt)}</p>
                    </div>
                    <button onClick={() => setSelectedBooking(null)} className="rounded-lg p-2 text-slate-400 hover:bg-gray-200 hover:text-slate-700 shrink-0 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 bg-white flex-wrap">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded border ${selectedBooking.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : selectedBooking.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                        {selectedBooking.status}
                    </span>
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded border ${selectedBooking.paymentMethod === 'Pay at Salon' ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>
                        {selectedBooking.paymentMethod}
                    </span>
                    {selectedBooking.queueStatus && (
                        <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded border bg-purple-50 text-purple-600 border-purple-200">
                            Queue: {selectedBooking.queueStatus}
                        </span>
                    )}

                    {(selectedBooking.status === 'confirmed' || selectedBooking.status === 'completed') && (
                        <button 
                            onClick={() => setShowInvoice(true)} 
                            className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1"
                        >
                            <FileText size={14}/> View Bill
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50/50 pb-6 hide-scrollbar">
                    
                    <DetailSection icon={<User className="text-blue-500" size={18}/>} title="Customer Info">
                        <InfoRow label="Name" value={selectedBooking.userName} />
                        <InfoRow label="Phone" value={selectedBooking.userPhone} />
                        <InfoRow label="User ID" value={selectedBooking.userId} />
                    </DetailSection>

                    <DetailSection icon={<CalendarCheck className="text-orange-500" size={18}/>} title="Appointment Info">
                        <InfoRow label="Type" value={selectedBooking.bookingType} />
                        <InfoRow label="Date" value={selectedBooking.date} />
                        <InfoRow label="Time" value={selectedBooking.time} />
                        <InfoRow label="Token No." value={selectedBooking.tokenNumber} />
                        <InfoRow label="OTP" value={selectedBooking.otp} />
                        <InfoRow label="Extra Time" value={selectedBooking.extraTime ? `${selectedBooking.extraTime} mins` : "0 mins"} />
                    </DetailSection>

                    <div className="border-b border-slate-200 px-6 py-5 bg-white">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Scissors className="text-pink-500" size={18}/> Services Selected
                        </h3>
                        <div className="space-y-3">
                            {Array.isArray(selectedBooking.services) && selectedBooking.services.length > 0 ? (
                                selectedBooking.services.map((svc, idx) => (
                                    <div key={idx} className="flex gap-3 items-start bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div className="w-12 h-12 rounded-lg bg-gray-200 overflow-hidden shrink-0 border border-gray-300 shadow-sm flex items-center justify-center">
                                            {svc.image ? <img src={svc.image} alt={svc.name} className="w-full h-full object-cover"/> : <Scissors size={20} className="text-gray-400"/>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-800 break-words leading-tight">{svc.name || svc.serviceName}</p>
                                            <p className="text-xs text-gray-500 mt-1">{svc.time || '30 Mins'}</p>
                                        </div>
                                        <div className="font-bold text-gray-900 shrink-0">₹{svc.price}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex gap-3 items-start bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <div className="w-12 h-12 rounded-lg bg-gray-200 overflow-hidden shrink-0 border border-gray-300 shadow-sm flex items-center justify-center">
                                        <Scissors size={20} className="text-gray-400"/>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-800 break-words leading-tight">{selectedBooking.serviceName || "Unknown Service"}</p>
                                        <p className="text-xs text-gray-500 mt-1">{selectedBooking.time || '—'}</p>
                                    </div>
                                    <div className="font-bold text-gray-900 shrink-0">₹{selectedBooking.totalAmount}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DetailSection icon={<CreditCard className="text-emerald-500" size={18}/>} title="Payment Details">
                        <InfoRow label="Subtotal" value={selectedBooking.subTotal != null ? `₹${selectedBooking.subTotal}` : '—'} />
                        <InfoRow label="Discount" value={selectedBooking.discountAmount ? `- ₹${selectedBooking.discountAmount}` : '₹0'} />
                        <InfoRow label="Promo Code" value={selectedBooking.promoCode} />
                        <div className="my-2 border-b border-dashed border-gray-200"></div>
                        <InfoRow label="Total Amount" value={`₹${selectedBooking.totalAmount}`} boldValue />
                        
                        <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 my-3 space-y-2">
                            <InfoRow label="Advance Paid" value={selectedBooking.advancePaid != null ? `₹${selectedBooking.advancePaid}` : '—'} />
                            <InfoRow label="Due at Salon" value={selectedBooking.amountDueAtSalon != null ? `₹${selectedBooking.amountDueAtSalon}` : '—'} boldValue/>
                        </div>
                        
                        <InfoRow label="Total Online Paid" value={selectedBooking.totalOnlinePaid != null ? `₹${selectedBooking.totalOnlinePaid}` : '—'} />
                        <InfoRow label="Gateway Fee" value={selectedBooking.paymentGatewayFee != null ? `₹${selectedBooking.paymentGatewayFee}` : '—'} />
                        <InfoRow label="Payment ID" value={selectedBooking.paymentId} />

                        <div className="mt-4 pt-3 border-t border-gray-200">
                            <InfoRow label="Admin Comm." value={`₹${selectedBooking.adminCommission}`} boldValue />
                            <div className="mb-2.5 grid grid-cols-[120px_1fr] gap-3">
                                <span className="text-xs font-medium text-slate-500 shrink-0">Comm. Status</span>
                                <div className="flex items-center gap-3">
                                    <span className={`text-sm font-bold ${selectedBooking.commissionStatus === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
                                        {selectedBooking.commissionStatus.toUpperCase()}
                                    </span>
                                    <button 
                                        onClick={() => toggleCommission(selectedBooking)}
                                        className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded font-bold transition-colors"
                                    >
                                        Mark as {selectedBooking.commissionStatus === 'paid' ? 'Pending' : 'Paid'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </DetailSection>

                    {selectedBooking.status === 'cancelled' && (
                        <DetailSection icon={<AlertCircle className="text-red-500" size={18}/>} title="Cancellation & Refund">
                            <InfoRow label="Cancelled By" value={selectedBooking.cancelledBy?.toUpperCase()} />
                            <InfoRow label="Reason" value={selectedBooking.cancellationReason} />
                            <InfoRow label="Cancelled At" value={formatTimestamp(selectedBooking.cancelledAt)} />
                            <div className="my-2 border-b border-dashed border-gray-200"></div>
                            <InfoRow label="Cancellation Fee" value={selectedBooking.cancellationFee != null ? `₹${selectedBooking.cancellationFee}` : '—'} />
                            <InfoRow label="Refund Amount" value={selectedBooking.refundAmount != null ? `₹${selectedBooking.refundAmount}` : '—'} boldValue />
                            <InfoRow label="Refund Status" value={selectedBooking.refundStatus?.toUpperCase()} />
                            <InfoRow label="Refund ID" value={selectedBooking.refundId} />
                        </DetailSection>
                    )}

                    <DetailSection icon={<Store className="text-purple-500" size={18}/>} title="Salon Info">
                        <InfoRow label="Name" value={selectedBooking.salonName} />
                        <InfoRow label="Address" value={selectedBooking.salonAddress} />
                        <InfoRow label="Salon ID" value={selectedBooking.salonId} />
                        <InfoRow label="Booking Notes" value={selectedBooking.bookingNotes} />
                    </DetailSection>
                </div>
            </div>
        </>
      )}

      {/* =========================================
          🔥 NEW: FULL SCREEN INVOICE MODAL 🔥
      ========================================= */}
      {showInvoice && (
          <InvoiceModal 
            booking={selectedBooking} 
            onClose={() => setShowInvoice(false)} 
            partners={partners} 
          />
      )}
    </div>
  );
}

// =====================================================
// INVOICE MODAL COMPONENT (100% IFRAME BASED FULL STRETCH)
// =====================================================
const InvoiceModal = ({ booking, onClose, partners }) => {
    const [logoError, setLogoError] = useState(false);
    
    // Data Preparation
    const salonData = partners.find(p => p.id === booking.salonId);
    const salonName = salonData?.name || salonData?.basicInfo?.salonName || "Digisaloon Admin";
    
    let fullAddress = "Address not available";
    if (salonData?.address) {
        if (typeof salonData.address === 'object') {
            const areaStr = salonData.address.area || '';
            const cityStr = salonData.address.city || '';
            const pinStr = salonData.address.pincode || '';
            let fAddr = [areaStr, cityStr].filter(Boolean).join(', ');
            if (pinStr) fAddr += ` - ${pinStr}`;
            fullAddress = fAddr || "Address not available";
        } else {
            fullAddress = salonData.address;
        }
    }

    const isGstRegistered = salonData?.legal?.gstRegistered === 'Yes';
    const gstNumber = salonData?.legal?.gstNumber || 'NA';
    const gstRate = salonData?.legal?.gstRate ? Number(salonData.legal.gstRate) : 18;

    const isWalkIn = booking?.bookingType === "Walk-in";
    const sList = booking?.services || booking?.serviceName || [];

    const realDiscount = Number(booking?.discountAmount || 0);
    const discountAmt = realDiscount; 
    const realSubTotal = Number(booking?.subTotal || booking?.serviceAmount || 0);
    const subtotalAmount = realSubTotal || Number(booking?.totalAmount || 0);
    const netServiceValue = Math.max(0, subtotalAmount - discountAmt);

    const advancePaid = Number(booking?.advancePaid || 49.00);
    let gatewayFee = Number(booking?.paymentGatewayFee || booking?.platformFee || 1.19);
    if (advancePaid === 49 && (gatewayFee === 1.2 || gatewayFee === 1.20)) {
        gatewayFee = 1.19;
    }

    const totalPaidOnline = advancePaid + gatewayFee;
    const payableAtSalon = Math.max(0, netServiceValue - advancePaid);

    let taxableValue = netServiceValue;
    let cgst = 0;
    let sgst = 0;

    if (isGstRegistered && gstRate > 0) {
        const gstMultiplier = gstRate / 100;
        taxableValue = netServiceValue / (1 + gstMultiplier);
        const totalGstAmount = netServiceValue - taxableValue;
        cgst = totalGstAmount / 2;
        sgst = totalGstAmount / 2;
    }

    const invoiceData = {
        invoiceId: booking?.id || 'N/A',
        userName: booking?.userName || 'Customer',
        customerPhone: booking?.userPhone || 'N/A',
        tokenNumber: booking?.tokenNumber || 'N/A',
        paymentMethod: booking?.paymentMethod || (isWalkIn ? 'Pay at Salon' : 'RAZORPAY ONLINE'),
        date: booking?.date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        promoCode: booking?.promoCode || 'PROMO'
    };

    // 🔥 EXACT PARTNER APP HTML STRING LOGIC 🔥
    const handleSaveAsPDF = () => {
        let servicesHTML = '';
        if (Array.isArray(sList)) {
            servicesHTML = sList.map((s, index) => {
                const isLast = index === sList.length - 1;
                return `
                    <div class="row item-row" style="align-items: flex-start; margin-bottom: 0; padding-bottom: 10px; border-bottom: ${isLast ? 'none' : '1px dashed #cbd5e1'};">
                        <span class="service-name" style="padding-right: 20px;">${s.name || s.serviceName || s}</span> 
                        <span class="service-price">₹${Number(s.price || 0).toFixed(2)}</span>
                    </div>
                `;
            }).join('');
        } else if (typeof sList === 'string') {
            const parts = sList.split(' • ');
            servicesHTML = parts.map((s, i) => {
                const isLast = i === parts.length - 1;
                return `
                    <div class="row item-row" style="align-items: flex-start; margin-bottom: 0; padding-bottom: 10px; border-bottom: ${isLast ? 'none' : '1px dashed #cbd5e1'};">
                        <span class="service-name" style="padding-right: 20px;">${s}</span> 
                        <span class="service-price">₹${(i === 0 ? subtotalAmount : 0).toFixed(2)}</span>
                    </div>
                `;
            }).join('');
        }

        const tokenDisplay = invoiceData.tokenNumber !== 'N/A' ? `<span style="flex-shrink: 0; text-align: right;"><strong>Token:</strong> #${invoiceData.tokenNumber}</span>` : '';
        const phoneDisplay = invoiceData.customerPhone !== 'N/A' ? `<div class="row"><span><strong>Phone:</strong> ${invoiceData.customerPhone}</span></div>` : '';
        
        // Remote logo as fallback string interpolation for pure HTML iframe
        const logoUrlToUse = typeof logoImage === 'string' ? logoImage : 'https://firebasestorage.googleapis.com/v0/b/digitalsaloon-bad62.firebasestorage.app/o/app%20logos%2Flogo.PNG?alt=media&token=849307ab-a7ea-4e92-9484-685fecb99e48';
        const logoHtml = `<img src="${logoUrlToUse}" alt="Logo" style="width: 60px; height: 60px; margin-top: 10px;" onerror="this.style.display='none'" />`;

        let taxHtml = '';
        if (isGstRegistered && gstRate > 0) {
            taxHtml = `
                <div class="tax-box">
                    <div class="tax-header">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        Tax Breakdown <span style="font-weight: normal; color: #64748B;">(Included in Net Estimated Service Value)</span>
                    </div>
                    <div class="tax-grid">
                        <div class="tax-col">
                            <div class="tax-label">Taxable Value</div>
                            <div class="tax-val">₹${taxableValue.toFixed(2)}</div>
                        </div>
                        <div class="tax-col" style="border-left: 1px dashed #cbd5e1; border-right: 1px dashed #cbd5e1;">
                            <div class="tax-label">CGST (${gstRate / 2}%)</div>
                            <div class="tax-val">₹${cgst.toFixed(2)}</div>
                        </div>
                        <div class="tax-col">
                            <div class="tax-label">SGST (${gstRate / 2}%)</div>
                            <div class="tax-val">₹${sgst.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <title>Invoice_${invoiceData.invoiceId.toString().slice(-6)}</title>
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 20px; width: 100%; max-width: 100%; margin: 0 auto; box-sizing: border-box; }
                        .center { text-align: center; }
                        .bold { font-weight: bold; }
                        .dashed-line { border-bottom: 1px dashed #94a3b8; margin: 20px 0; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; gap: 10px; align-items: center; }
                        .item-row { margin-bottom: 8px; font-size: 14px; color: #334155; }
                        h2 { margin: 5px 0; font-size: 20px; color: #0f172a; text-transform: uppercase; }
                        h3 { margin: 25px 0 15px 0; font-size: 15px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; }
                        p, span { margin: 3px 0; font-size: 14px; word-break: break-word; overflow-wrap: break-word; }
                        .service-name { flex: 1; padding-right: 10px; }
                        .service-price { flex-shrink: 0; font-weight: 600; color: #0f172a; }
                        .highlight-row { padding: 12px 0; border-top: 1px dashed #94a3b8; border-bottom: 1px dashed #94a3b8; margin: 15px 0; color: #0f172a; font-weight: 800; }
                        .tax-box { border: 1px dashed #cbd5e1; border-radius: 4px; padding: 15px; margin-top: 15px; }
                        .tax-header { font-size: 12px; font-weight: bold; color: #475569; margin-bottom: 12px; }
                        .tax-grid { display: flex; justify-content: space-between; text-align: center; }
                        .tax-col { flex: 1; }
                        .tax-label { font-size: 11px; color: #64748B; margin-bottom: 4px; }
                        .tax-val { font-size: 13px; font-weight: bold; color: #0f172a; }
                        .info-text { font-size: 12px; color: #475569; display: flex; align-items: center; margin-top: 5px; padding: 10px; border: 1px dashed #cbd5e1; border-radius: 4px;}
                        
                        @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
                            @page { size: A4 portrait; margin: 12mm; }
                        }
                    </style>
                </head>
                <body>
                    <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                        <span style="font-size: 12px; color: #64748b;">${invoiceData.date}</span>
                        <span style="font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Digisaloon ADMIN</span>
                    </div>

                    <div class="center">
                        <h2>TAX INVOICE</h2>
                        <p class="bold" style="font-size:11px; color: #64748B;">ORIGINAL</p>
                        ${logoHtml}
                        <h1 style="margin: 5px 0 5px 0; font-size:24px; color: #0f172a; letter-spacing: 1px;">DIGISALOON</h1>
                        <p class="bold" style="font-size: 16px;">${salonName}</p>
                        <p style="color: #475569; font-size: 13px;">${fullAddress}</p>
                        <p style="color: #475569; font-size: 13px;">GST No: ${isGstRegistered ? gstNumber : 'NA'}</p>
                    </div>
                    
                    <div class="dashed-line"></div>
                    
                    <div class="row">
                        <span><strong>Order No:</strong> ${invoiceData.invoiceId.toString().slice(-6)}</span>
                        <span><strong>Date:</strong> ${invoiceData.date}</span>
                    </div>
                    <div class="row" style="align-items: flex-start;">
                        <span class="customer-name"><strong>Customer:</strong> ${invoiceData.userName}</span>
                        ${tokenDisplay}
                    </div>
                    ${phoneDisplay}

                    <div class="dashed-line"></div>

                    <h3>SERVICES(ESTIMATED)</h3>
                    ${servicesHTML}
                    
                    ${discountAmt > 0 ? `
                    <div class="row item-row" style="border-top: 1px dashed #cbd5e1; padding-top: 12px; margin-top: 4px;">
                        <span>Coupon Discount (${invoiceData.promoCode})</span>
                        <span style="font-weight: bold;">-₹${discountAmt.toFixed(2)}</span>
                    </div>
                    ` : ''}

                    <div class="row highlight-row" style="align-items: flex-start;">
                        <div style="flex: 1; padding-right: 10px;">
                            <span style="display: block;">Net Estimated Service Value</span>
                            <span style="font-size: 12px; font-weight: normal; color: #64748b;">(After Discount)</span>
                        </div>
                        <span>₹${netServiceValue.toFixed(2)}</span>
                    </div>

                    ${taxHtml}
                    
                    ${!isWalkIn ? `
                    <h3 style="margin-top: 25px;">BOOKING PAYMENT (Online)</h3>
                    <div class="row item-row" style="align-items: flex-start;">
                        <div style="flex: 1; padding-right: 10px;">
                            <span style="display: block;">Booking Amount Paid</span>
                            <span style="display: block; font-size: 11px; color: #64748b; margin-top: 3px; line-height: 1.3;">
                                This amount is for your salon booking and will be transferred to the salon.
                            </span>
                        </div>
                        <span class="service-price">₹${advancePaid.toFixed(2)}</span>
                    </div>
                    
                    <div class="row item-row">
                        <span>Payment Gateway Fee</span>
                        <span class="service-price">₹${gatewayFee.toFixed(2)}</span>
                    </div>
                    <div class="row highlight-row">
                        <span>Total Paid Online</span>
                        <span>₹${totalPaidOnline.toFixed(2)}</span>
                    </div>
                    <div class="info-text">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        ₹${advancePaid.toFixed(0)} will be adjusted in your final salon bill.
                    </div>
                    ` : ''}

                    <h3 style="margin-top: 25px;">SALON PAYMENT</h3>
                    <div class="row item-row">
                        <span>Net Service Value</span>
                        <span class="service-price">₹${netServiceValue.toFixed(2)}</span>
                    </div>
                    ${!isWalkIn ? `
                    <div class="row item-row">
                        <span>Less: Booking Amount Paid</span>
                        <span class="service-price">-₹${advancePaid.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="row highlight-row">
                        <span>${isWalkIn ? 'Estimated Payable at Salon' : 'Estimated Payable at Salon'}</span>
                        <span>₹${(isWalkIn ? netServiceValue : payableAtSalon).toFixed(2)}</span>
                    </div>

                    <div class="center" style="margin-top: 30px; margin-bottom: 20px;">
                        <p class="bold" style="color: #1e293b; font-size: 14px;">Thank you for choosing DigiSaloon!</p>
                        <p style="color: #64748b; font-size: 12px;">Your style, your time, our priority.</p>
                    </div>
                </body>
            </html>
        `;

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(htmlContent);
        iframe.contentWindow.document.close();
        
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => document.body.removeChild(iframe), 1500);
        }, 500);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#F0F2F5] overflow-y-auto pb-24 font-sans text-[#111111]">
            <div className="flex items-center justify-between px-5 py-4 bg-[#991B1B] shadow-sm sticky top-0 z-50">
                <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors -ml-1">
                    <ArrowLeft size={24} color="#FFFFFF" />
                </button>
                <h1 className="text-[18px] font-bold text-white">Receipt</h1>
                <div className="w-8"></div>
            </div>

            <div className="p-5 flex flex-col items-center w-full">
                
                {/* 🔴 YE SIRF SCREEN PE DIKHANE KE LIYE HAI, PRINT NAHI HOGA 🔴 */}
                <div className="bg-white w-full max-w-[420px] p-6 rounded-xl shadow-md border border-gray-100">
                    <div className="flex flex-col items-center text-center">
                        <h2 className="text-[16px] font-[800] text-[#0f172a] tracking-wide">TAX INVOICE</h2>
                        <span className="text-[10px] font-bold text-[#64748B] mt-0.5">ORIGINAL</span>

                        {logoError ? (
                            <div className="w-[60px] h-[60px] rounded-full bg-[#991B1B] text-white flex items-center justify-center shadow-sm mt-4 mb-1.5 border-2 border-white ring-1 ring-gray-200">
                                <span className="text-[28px] font-black italic pr-1">D</span>
                            </div>
                        ) : (
                            <img
                                src={typeof logoImage !== 'undefined' ? logoImage : 'https://firebasestorage.googleapis.com/v0/b/digitalsaloon-bad62.firebasestorage.app/o/app%20logos%2Flogo.PNG?alt=media'}
                                alt="Digisaloon Logo"
                                className="w-[60px] h-[60px] rounded-full object-contain mt-4 mb-1.5 shadow-sm"
                                onError={() => setLogoError(true)}
                            />
                        )}

                        <h1 className="text-[22px] font-[900] text-[#0f172a] tracking-[1px] mt-1">DIGISALOON</h1>
                        <p className="text-[13px] font-bold text-[#0f172a] px-4 mt-1 leading-snug w-full break-words break-all whitespace-normal">
                            {salonName}
                        </p>
                        <p className="text-[13px] text-[#475569] mt-1 px-4 text-center leading-snug w-full break-words break-all whitespace-normal">
                            {fullAddress}
                        </p>
                        <p className="text-[13px] text-[#475569] mt-1">GST No: {isGstRegistered ? gstNumber : 'NA'}</p>
                    </div>

                    <div className="w-full border-b border-dashed border-[#E2E8F0] my-5"></div>

                    <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[13px] text-[#475569]">Order No: <span className="text-[#0f172a] font-bold">{invoiceData.invoiceId.toString().slice(-6)}</span></span>
                        <span className="text-[13px] text-[#475569]">Date: <span className="text-[#0f172a] font-bold">{invoiceData.date}</span></span>
                    </div>

                    <div className="flex justify-between items-start mt-1.5">
                        <div className="flex-1 pr-2">
                            <span className="text-[13px] text-[#475569] block truncate" title={invoiceData.userName}>
                                Customer: <span className="text-[#0f172a] font-bold">{invoiceData.userName}</span>
                            </span>
                        </div>
                        {invoiceData.tokenNumber !== 'N/A' && (
                            <div className="shrink-0 text-right">
                                <span className="text-[13px] text-[#475569]">Token: <span className="text-[#0f172a] font-bold">#{invoiceData.tokenNumber}</span></span>
                            </div>
                        )}
                    </div>

                    {invoiceData.customerPhone !== 'N/A' && (
                        <div className="mt-1.5">
                            <span className="text-[13px] text-[#475569]">Phone: <span className="text-[#0f172a] font-bold">{invoiceData.customerPhone}</span></span>
                        </div>
                    )}

                    <div className="w-full border-b border-dashed border-[#E2E8F0] my-5"></div>

                    <h3 className="text-[14px] font-[900] text-[#1e293b] tracking-[0.5px] uppercase mb-2">SERVICES(ESTIMATED)</h3>

                    {Array.isArray(sList) ? (
                        sList.map((s, i) => {
                            const isLast = i === sList.length - 1;
                            return (
                                <div key={i} className={`flex justify-between items-start py-2 ${isLast ? '' : 'border-b border-dashed border-[#E2E8F0]'}`}>
                                    <span className="text-[13px] text-[#334155] flex-1 pr-5">{s.name || s.serviceName || s}</span>
                                    <span className="text-[13px] font-[700] text-[#0f172a]">₹{Number(s.price || 0).toFixed(2)}</span>
                                </div>
                            );
                        })
                    ) : typeof sList === 'string' ? (
                        sList.split(' • ').map((s, i, arr) => {
                            const isLast = i === arr.length - 1;
                            return (
                                <div key={i} className={`flex justify-between items-start py-2 ${isLast ? '' : 'border-b border-dashed border-[#E2E8F0]'}`}>
                                    <span className="text-[13px] text-[#334155] flex-1 pr-5">{s}</span>
                                    <span className="text-[13px] font-[700] text-[#0f172a]">₹{(i === 0 ? subtotalAmount : 0).toFixed(2)}</span>
                                </div>
                            );
                        })
                    ) : null}

                    {discountAmt > 0 && (
                        <div className="flex justify-between items-center pt-2.5 pb-2 border-t border-dashed border-[#E2E8F0]">
                            <span className="text-[13px] text-[#334155]">Coupon Discount ({invoiceData.promoCode})</span>
                            <span className="text-[13px] font-[700] text-[#0f172a]">-₹{discountAmt.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center py-2.5 my-2 border-y border-dashed border-[#E2E8F0]">
                        <div className="flex-1 pr-2">
                            <span className="text-[13px] font-[800] text-[#0f172a] block">Net Estimated Service Value</span>
                            <span className="text-[11px] font-[500] text-[#64748b] mt-0.5">(After Discount)</span>
                        </div>
                        <span className="text-[14px] font-[900] text-[#0f172a]">₹{netServiceValue.toFixed(2)}</span>
                    </div>

                    {isGstRegistered && gstRate > 0 && (
                        <div className="border border-dashed border-[#E2E8F0] rounded-lg p-3 mt-3">
                            <div className="flex items-center mb-3">
                                <Info size={14} className="text-[#475569] mr-1.5 shrink-0" />
                                <span className="text-[11px] font-bold text-[#475569]">
                                    Tax Breakdown <span className="font-normal text-[#64748B]">(Included in Net Estimated Service Value)</span>
                                </span>
                            </div>
                            <div className="flex justify-between text-center divide-x divide-dashed divide-[#E2E8F0]">
                                <div className="flex-1">
                                    <p className="text-[10px] text-[#64748B] mb-1">Taxable Value</p>
                                    <p className="text-[12px] font-bold text-[#334155]">₹{taxableValue.toFixed(2)}</p>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] text-[#64748B] mb-1">CGST ({gstRate / 2}%)</p>
                                    <p className="text-[12px] font-bold text-[#334155]">₹{cgst.toFixed(2)}</p>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] text-[#64748B] mb-1">SGST ({gstRate / 2}%)</p>
                                    <p className="text-[12px] font-bold text-[#334155]">₹{sgst.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isWalkIn && (
                        <>
                            <h3 className="text-[14px] font-[900] text-[#1e293b] tracking-[0.5px] uppercase mt-5 mb-2">BOOKING PAYMENT (Online)</h3>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex flex-col flex-1 pr-4">
                                    <span className="text-[13px] text-[#334155]">Booking Amount Paid</span>
                                    <span className="text-[9px] text-[#64748b] leading-tight mt-0.5 max-w-[200px]">
                                        This amount is for your salon booking and will be transferred to the salon.
                                    </span>
                                </div>
                                <span className="text-[13px] font-[700] text-[#0f172a] shrink-0 mt-0.5">₹{advancePaid.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[13px] text-[#334155]">Payment Gateway Fee</span>
                                <span className="text-[13px] font-[700] text-[#0f172a]">₹{gatewayFee.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2.5 my-2 border-y border-dashed border-[#E2E8F0]">
                                <span className="text-[13px] font-[800] text-[#0f172a]">Total Paid Online</span>
                                <span className="text-[14px] font-[900] text-[#0f172a]">₹{totalPaidOnline.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center mt-1.5 p-2 rounded-md border border-dashed border-[#E2E8F0]">
                                <Info size={14} className="text-[#64748b] mr-1.5 shrink-0" />
                                <span className="text-[11px] text-[#475569]">₹{advancePaid.toFixed(0)} will be adjusted in your final salon bill.</span>
                            </div>
                        </>
                    )}

                    <h3 className="text-[14px] font-[900] text-[#1e293b] tracking-[0.5px] uppercase mt-5 mb-2">SALON PAYMENT</h3>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[13px] text-[#334155]">Net Estimated Service Value</span>
                        <span className="text-[13px] font-[700] text-[#0f172a]">₹{netServiceValue.toFixed(2)}</span>
                    </div>

                    {!isWalkIn && (
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[13px] text-[#334155]">Less: Booking Amount Paid</span>
                            <span className="text-[13px] font-[700] text-[#0f172a]">-₹{advancePaid.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center py-2.5 my-2 border-y border-dashed border-[#E2E8F0]">
                        <span className="text-[13px] font-[800] text-[#0f172a]"> Estimated Payable at Salon</span>
                        <span className="text-[14px] font-[900] text-[#0f172a]">₹{isWalkIn ? netServiceValue.toFixed(2) : payableAtSalon.toFixed(2)}</span>
                    </div>

                    <div className="text-center mt-5 mb-2">
                        <p className="text-[13px] font-bold text-[#1e293b] mt-1">Thank you for choosing DigiSaloon!</p>
                        <p className="text-[11px] text-[#64748b] mt-1">Your style, your time, our priority.</p>
                    </div>

                </div> 

                <div className="w-full max-w-[420px] mt-6">
                    <button
                        onClick={handleSaveAsPDF}
                        className="w-full bg-[#991B1B] text-white py-3.5 rounded-xl font-bold text-[16px] flex justify-center items-center shadow-lg transition-colors hover:bg-red-800"
                    >
                        <Download size={20} className="mr-2" />
                        Save as PDF / Print
                    </button>
                </div>
            </div>
        </div>
    );
};

// =====================================================
// HELPER COMPONENTS FOR DRAWER
// =====================================================
const DetailSection = ({ icon, title, children }) => (
  <div className="border-b border-slate-200 px-6 py-5 bg-white">
    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        {icon} {title}
    </h3>
    {children}
  </div>
);

const InfoRow = ({ label, value, boldValue = false }) => (
  <div className="mb-2.5 grid grid-cols-[120px_1fr] gap-3 last:mb-0">
    <span className="text-xs font-medium text-slate-500 shrink-0">{label}</span>
    <span className={`text-sm break-words min-w-0 ${boldValue ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
        {value || "—"}
    </span>
  </div>
);