import { useState, useEffect } from "react";
import { db } from "../firebase-config";
import { collection, getDocs, collectionGroup } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
    Users, Scissors, Calendar, Loader2, Trophy,
    PieChart, CheckCircle, XCircle, Clock, Star,
    AlertCircle, Filter, Activity, AlertTriangle
} from "lucide-react";

// Helper function timeAgo format ke liye
const timeAgo = (date) => {
    if (!date || isNaN(date)) return "Recently";
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 0) return "Upcoming";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

export default function Dashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Date Range aur Raw Data States
    const [dateRange, setDateRange] = useState("all");
    const [rawData, setRawData] = useState({ bookings: [], salons: [], users: [] });

    const [stats, setStats] = useState({
        bookings: 0,
        salons: 0,
        users: 0,
        pendingSalonsCount: 0
    });

    const [chartData, setChartData] = useState([]);
    const [topSalons, setTopSalons] = useState([]);
    const [topServices, setTopServices] = useState([]);
    const [statusData, setStatusData] = useState({ completed: 0, cancelled: 0, pending: 0 });

    // Widgets & Top Bookings Table States
    const [activities, setActivities] = useState([]);
    const [topCancelled, setTopCancelled] = useState([]);
    const [filteredBookingsList, setFilteredBookingsList] = useState([]);
    const [bookingSortMode, setBookingSortMode] = useState("latest"); // "latest" | "amount"
    const [bookingLimit, setBookingLimit] = useState(10); // 5 | 10
    const [appOnlyBookings, setAppOnlyBookings] = useState(true);

    // 1. Ek baar Data Fetch karo
    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [salonsSnap, usersSnap, bookingsSnap] = await Promise.all([
                getDocs(collection(db, "partners")),
                getDocs(collection(db, "users")),
                getDocs(collectionGroup(db, "bookings")),
            ]);

            const fetchedSalons = salonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const fetchedUsers = usersSnap.docs.map(doc => {
                const data = doc.data();
                let dateObj = null;
                if (data.createdAt?.toDate) dateObj = data.createdAt.toDate();
                else if (data.timestamp?.toDate) dateObj = data.timestamp.toDate();
                return { id: doc.id, name: data.name || data.userName || "A User", dateObj };
            });

            const fetchedBookings = bookingsSnap.docs.map(doc => {
                const data = doc.data();
                let dateObj = null;
                if (data.date && typeof data.date === 'string') dateObj = new Date(data.date);
                else if (data.timestamp?.toDate) dateObj = data.timestamp.toDate();

                // Exact booking creation time (latest sort ke liye)
                let createdAtObj = null;
                if (data.createdAt?.toDate) createdAtObj = data.createdAt.toDate();
                else if (data.timestamp?.toDate) createdAtObj = data.timestamp.toDate();
                else createdAtObj = dateObj;

                return {
                    id: doc.id,
                    path: doc.ref.path,
                    partnerId: doc.ref.parent.parent?.id,
                    dateObj,
                    createdAtObj,
                    ...data
                };
            });

            setRawData({
                bookings: fetchedBookings,
                salons: fetchedSalons,
                users: fetchedUsers
            });
        } catch (error) {
            console.error("Dashboard Error:", error);
        }
        setLoading(false);
    };

    useEffect(() => { fetchDashboardData(); }, []);

    // 2. Jab bhi Date Filter change ho, Data process karo
    useEffect(() => {
        if (rawData.salons.length === 0 && rawData.bookings.length === 0 && rawData.users.length === 0) return;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const isWithinRange = (dateObj) => {
            if (!dateObj || isNaN(dateObj)) return false;
            if (dateRange === 'all') return true;
            if (dateRange === 'today') return dateObj >= todayStart;
            if (dateRange === 'week') {
                const lastWeek = new Date(todayStart);
                lastWeek.setDate(lastWeek.getDate() - 7);
                return dateObj >= lastWeek;
            }
            if (dateRange === 'month') {
                const lastMonth = new Date(todayStart);
                lastMonth.setMonth(lastMonth.getMonth() - 1);
                return dateObj >= lastMonth;
            }
            return true;
        };

        const salonMap = {};
        let pendingSalons = 0;

        rawData.salons.forEach(d => {
            const name = d.basicInfo?.salonName || d.salonName || "Unknown Salon";
            salonMap[d.id] = name;
            if (d.status === 'pending') pendingSalons++;
        });

        let validBookingCount = 0;
        const salonPerformance = {};
        const servicePerformance = {};
        const dateMap = {};

        let localActivities = [];
        let localCancellations = {};
        let localBookingsList = [];
        let sCompleted = 0, sCancelled = 0, sPending = 0;

        // Add User Registrations to Activity Feed
        rawData.users.forEach(u => {
            if (u.dateObj && isWithinRange(u.dateObj)) {
                localActivities.push({
                    id: `u_${u.id}`,
                    title: `New user ${u.name} joined`,
                    time: u.dateObj,
                    icon: <Users size={14} />,
                    color: 'text-blue-600',
                    bg: 'bg-blue-100'
                });
            }
        });

        rawData.bookings.forEach(data => {
            if (!data.path.includes("partners/")) return;
            if (!isWithinRange(data.dateObj)) return;

            validBookingCount++;
            const amount = Number(data.totalAmount || data.price || 0);
            const status = data.status?.toLowerCase() || "pending";
            const resolvedName = data.salonName || salonMap[data.partnerId] || "Unknown Salon";

            if (status === 'completed') sCompleted++;
            else if (status === 'cancelled' || status === 'rejected') sCancelled++;
            else sPending++;

            // Clean services text for Top Bookings Card
            let servicesText = "Salon Service";
            if (Array.isArray(data.services) && data.services.length > 0) {
                servicesText = data.services.map(s => (typeof s === 'object' ? s.name : s)).filter(Boolean).join(', ');
            } else if (data.service) {
                servicesText = Array.isArray(data.service)
                    ? data.service.map(s => (typeof s === 'object' ? s.name : s)).join(', ')
                    : String(data.service);
            } else if (data.serviceName) {
                servicesText = String(data.serviceName);
            }

            localBookingsList.push({
                id: data.id,
                salonId: data.partnerId || data.salonId || "",
                salonName: resolvedName,
                customerName: data.userName || data.name || "Customer",
                customerPhone: data.userPhone || data.phone || "",
                servicesText,
                amount,
                status,
                tokenNumber: data.tokenNumber || null,
                isLive: data.isLive === true,
                isWalkIn: data.isWalkIn === true,
                bookingDate: data.date || (data.dateObj ? data.dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : "-"),
                bookingTime: data.time || "",
                sortTime: data.createdAtObj && !isNaN(data.createdAtObj) ? data.createdAtObj.getTime() : 0,
                createdAtObj: data.createdAtObj,
            });

            // Activity Feed Logic
            if (data.dateObj) {
                if (status === 'completed') {
                    localActivities.push({ id: `b_${data.id}`, title: `Booking completed at ${resolvedName}`, time: data.dateObj, icon: <CheckCircle size={14} />, color: 'text-green-600', bg: 'bg-green-100' });
                } else if (status === 'cancelled' || status === 'rejected') {
                    localActivities.push({ id: `b_${data.id}`, title: `Booking cancelled at ${resolvedName}`, time: data.dateObj, icon: <XCircle size={14} />, color: 'text-red-600', bg: 'bg-red-100' });
                    localCancellations[resolvedName] = (localCancellations[resolvedName] || 0) + 1;
                } else {
                    localActivities.push({ id: `b_${data.id}`, title: `New booking at ${resolvedName}`, time: data.dateObj, icon: <Clock size={14} />, color: 'text-yellow-600', bg: 'bg-yellow-100' });
                }
            }

            let serviceName = "Service";
            if (data.services?.[0]) serviceName = data.services[0].name || "Service";
            else if (data.service) serviceName = data.service;
            else if (data.serviceName) serviceName = data.serviceName;

            if (serviceName) {
                serviceName = String(serviceName).trim();
                servicePerformance[serviceName] = (servicePerformance[serviceName] || 0) + 1;
            }

            if (status === 'completed' || data.commissionStatus === 'paid' || data.paymentMethod === 'Online') {
                if (!salonPerformance[resolvedName]) {
                    salonPerformance[resolvedName] = { name: resolvedName, revenue: 0, bookings: 0 };
                }
                salonPerformance[resolvedName].revenue += amount;
                salonPerformance[resolvedName].bookings += 1;
            }

            if (data.dateObj && !isNaN(data.dateObj)) {
                const dateKey = data.dateObj.toISOString().split('T')[0];
                const displayKey = data.dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

                if (!dateMap[dateKey]) {
                    dateMap[dateKey] = { label: displayKey, count: 0, sortDate: data.dateObj };
                }
                dateMap[dateKey].count += 1;
            }
        });

        const sortedChartData = Object.values(dateMap)
            .sort((a, b) => a.sortDate - b.sortDate)
            .map(item => ({
                day: item.label,
                count: item.count,
                height: Math.min((item.count * 10) + 5, 100)
            }));

        if (sortedChartData.length === 0) {
            sortedChartData.push({ day: "No Data", count: 0, height: 2 });
        }

        const topSalonsList = Object.values(salonPerformance).sort((a, b) => b.revenue - a.revenue).slice(0, 4);
        const topServicesList = Object.entries(servicePerformance).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 4);

        localActivities.sort((a, b) => b.time - a.time);
        const topCancelledList = Object.entries(localCancellations).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 4);

        setStats({
            salons: rawData.salons.length,
            users: rawData.users.length,
            bookings: validBookingCount,
            pendingSalonsCount: pendingSalons
        });
        setChartData(sortedChartData);
        setTopSalons(topSalonsList);
        setTopServices(topServicesList);
        setStatusData({ completed: sCompleted, cancelled: sCancelled, pending: sPending });
        setActivities(localActivities.slice(0, 6));
        setTopCancelled(topCancelledList);
        setFilteredBookingsList(localBookingsList);

    }, [rawData, dateRange]);
    // Top 5 / 10 Bookings (App Only + Latest / Highest ₹)
    const displayedTopBookings = [...filteredBookingsList]
        .filter((b) => (appOnlyBookings ? !b.isWalkIn : true))
        .sort((a, b) =>
            bookingSortMode === "amount"
                ? b.amount - a.amount
                : b.sortTime - a.sortTime
        )
        .slice(0, bookingLimit);

    // Top 5 / 10 Bookings (App Only + Latest / Highest ₹)
   const toSalonSlug = (name = "", fallbackId = "") => {
        const slug = String(name)
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        return slug || fallbackId;
    };

    const handleBookingRowClick = (booking) => {
        if (!booking.salonId) return;
        const slug = toSalonSlug(booking.salonName, booking.salonId);
        navigate(`/bookings/${slug}`, {
            state: {
                salonId: booking.salonId,
                salonName: booking.salonName,
                bookingStatus: booking.status,
                bookingId: booking.id,
            },
        });
    };
    if (loading) {
        return (
            <div className="flex justify-center h-screen items-center">
                <Loader2 className="animate-spin text-blue-600" size={40} />
            </div>
        );
    }

    return (
        <div className="p-8 bg-gray-50/50 min-h-screen">

            {/* ACTION REQUIRED BANNER */}
            {stats.pendingSalonsCount > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><AlertCircle size={20} /></div>
                        <div>
                            <h4 className="font-bold text-orange-900 text-sm">Action Required</h4>
                            <p className="text-xs text-orange-700">{stats.pendingSalonsCount} {stats.pendingSalonsCount === 1 ? 'salon is' : 'salons are'} pending verification and approval.</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/manage-salons')} className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-sm">Review Now</button>
                </div>
            )}

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard Overview 📊</h1>
                    <p className="text-sm text-gray-500 mt-1">Real-time insights excluding test data.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-lg shadow-sm">
                        <Filter size={14} className="text-gray-400" />
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="text-sm font-bold text-gray-700 outline-none bg-transparent cursor-pointer"
                        >
                            <option value="today">Today</option>
                            <option value="week">Last 7 Days</option>
                            <option value="month">Last 30 Days</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                    <button onClick={fetchDashboardData} className="text-sm bg-white border border-gray-200 px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-2">
                        Refresh
                    </button>
                </div>
            </div>

            {/* TOP 3 STATS CARDS (Platform GMV & Net Revenue hata diye gaye hain) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Calendar size={18} /></div>
                        <span className="text-xs font-bold text-gray-400 uppercase">Bookings</span>
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">{stats.bookings}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Scissors size={18} /></div>
                        <span className="text-xs font-bold text-gray-400 uppercase">Salons</span>
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">{stats.salons}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Users size={18} /></div>
                        <span className="text-xs font-bold text-gray-400 uppercase">Users</span>
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">{stats.users}</h3>
                </div>
            </div>

            {/* 🔥 FULL-WIDTH BIG CARD: TOP 5-10 APP BOOKINGS (Booking Trends & Status ke upar) */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h3 className="font-bold text-lg text-gray-900">
                                {bookingSortMode === "latest"
                                    ? `Top ${bookingLimit} Recent App Bookings`
                                    : `Top ${bookingLimit} Highest Value Bookings`}
                            </h3>
                            <span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-100">
                                {displayedTopBookings.length} Showing
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            App se hui bookings aur unke salon details.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setAppOnlyBookings((prev) => !prev)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                appOnlyBookings
                                    ? "bg-black text-white border-black"
                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            }`}
                        >
                            {appOnlyBookings ? "App Only ✓" : "All (Inc. Walk-in)"}
                        </button>

                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setBookingSortMode("latest")}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                                    bookingSortMode === "latest" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                                }`}
                            >
                                Latest
                            </button>
                            <button
                                onClick={() => setBookingSortMode("amount")}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                                    bookingSortMode === "amount" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                                }`}
                            >
                                Highest ₹
                            </button>
                        </div>

                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            {[5, 10].map((num) => (
                                <button
                                    key={num}
                                    onClick={() => setBookingLimit(num)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                                        bookingLimit === num ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                                    }`}
                                >
                                    Top {num}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {displayedTopBookings.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">
                            Is time range mein koi bookings nahi mili.
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[780px]">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                    <th className="py-3.5 px-6"># / Token</th>
                                    <th className="py-3.5 px-4">Salon</th>
                                    <th className="py-3.5 px-4">Customer</th>
                                    <th className="py-3.5 px-4">Services</th>
                                    <th className="py-3.5 px-4">Slot & Booked</th>
                                    <th className="py-3.5 px-4 text-right">Amount</th>
                                    <th className="py-3.5 px-6 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {displayedTopBookings.map((b, idx) => {
                                    const statusStyles =
                                        b.status === "completed"
                                            ? "bg-green-50 text-green-700 border-green-200"
                                            : b.status === "cancelled" || b.status === "rejected"
                                            ? "bg-red-50 text-red-700 border-red-200"
                                            : b.status === "accepted" || b.status === "confirmed" || b.status === "serving"
                                            ? "bg-blue-50 text-blue-700 border-blue-200"
                                            : "bg-yellow-50 text-yellow-700 border-yellow-200";

                                    return (
                                    
                                        <tr
                                            key={b.id}
                                            onClick={() => handleBookingRowClick(b)}
                                            className="group hover:bg-blue-50/50 transition-colors cursor-pointer"
                                        >
                                            <td className="py-4 px-6 whitespace-nowrap">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-black flex items-center justify-center">
                                                        {idx + 1}
                                                    </span>
                                                    <div>
                                                        <div className="font-bold text-gray-900 text-xs">
                                                            {b.tokenNumber ? `Token #${b.tokenNumber}` : `#${b.id.slice(-5).toUpperCase()}`}
                                                        </div>
                                                        <span className={`inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                            b.isWalkIn
                                                                ? "bg-gray-100 text-gray-600"
                                                                : b.isLive
                                                                ? "bg-emerald-50 text-emerald-700"
                                                                : "bg-indigo-50 text-indigo-700"
                                                        }`}>
                                                            {b.isWalkIn ? "Walk-in" : b.isLive ? "Live Queue" : "Scheduled"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg shrink-0">
                                                        <Scissors size={14} />
                                                    </div>
                                                    <span
                                                        className="font-bold text-gray-900 text-xs max-w-[190px] truncate group-hover:text-blue-600 group-hover:underline"
                                                        title={b.salonName}
                                                    >
                                                        {b.salonName}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <div className="font-semibold text-gray-800 text-xs">{b.customerName}</div>
                                                {b.customerPhone ? (
                                                    <div className="text-[11px] text-gray-400 mt-0.5">{b.customerPhone}</div>
                                                ) : null}
                                            </td>

                                            <td className="py-4 px-4">
                                                <p className="text-xs text-gray-600 max-w-[200px] truncate" title={b.servicesText}>
                                                    {b.servicesText}
                                                </p>
                                            </td>

                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <div className="text-xs font-semibold text-gray-800">
                                                    {b.bookingDate}{b.bookingTime ? ` • ${b.bookingTime}` : ""}
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-0.5">
                                                    {timeAgo(b.createdAtObj)}
                                                </div>
                                            </td>

                                            <td className="py-4 px-4 text-right whitespace-nowrap">
                                                <span className="font-black text-gray-900 text-sm">
                                                    ₹{b.amount.toLocaleString()}
                                                </span>
                                            </td>

                                            <td className="py-4 px-6 text-center whitespace-nowrap">
                                                <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold capitalize border ${statusStyles}`}>
                                                    {b.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* BOTTOM GRID: Booking Trends, Status Breakdown, Top Partners, Top Services, Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-gray-900">Booking Trends</h3>
                            <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase">Active Days</span>
                        </div>
                        <div className="min-w-[500px]">
                            <div className="flex items-end h-52 gap-4 pt-4 pb-2">
                                {chartData.map((item, index) => (
                                    <div key={index} className="flex flex-col items-center gap-2 min-w-[40px] group cursor-pointer">
                                        <div className="relative w-full flex justify-end flex-col items-center h-40 bg-gray-50 rounded-full">
                                            <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10">
                                                {item.day}: {item.count}
                                            </div>
                                            <div style={{ height: `${item.height}%` }} className={`w-full rounded-b-full rounded-t-lg transition-all duration-700 ${item.count > 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-200'}`}></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">{item.day}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Status Breakdown */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
                            <PieChart size={18} className="text-gray-400" /> Status Breakdown
                        </h3>
                        <div className="flex h-4 w-full rounded-full overflow-hidden mb-4 bg-gray-100">
                            <div style={{ width: `${(statusData.completed / (stats.bookings || 1)) * 100}%` }} className="bg-green-500 h-full transition-all duration-500"></div>
                            <div style={{ width: `${(statusData.pending / (stats.bookings || 1)) * 100}%` }} className="bg-yellow-400 h-full transition-all duration-500"></div>
                            <div style={{ width: `${(statusData.cancelled / (stats.bookings || 1)) * 100}%` }} className="bg-red-500 h-full transition-all duration-500"></div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                                <p className="text-xs font-bold text-green-700 flex items-center justify-center gap-1"><CheckCircle size={12} /> Completed</p>
                                <p className="text-xl font-black text-gray-900 mt-1">{statusData.completed}</p>
                            </div>
                            <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                                <p className="text-xs font-bold text-yellow-700 flex items-center justify-center gap-1"><Clock size={12} /> Pending</p>
                                <p className="text-xl font-black text-gray-900 mt-1">{statusData.pending}</p>
                            </div>
                            <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                                <p className="text-xs font-bold text-red-700 flex items-center justify-center gap-1"><XCircle size={12} /> Cancelled</p>
                                <p className="text-xl font-black text-gray-900 mt-1">{statusData.cancelled}</p>
                            </div>
                        </div>
                    </div>

                    {/* Cancellation Metrics */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="text-red-500" size={20} />
                            <h3 className="font-bold text-lg text-gray-900">Highest Cancellations</h3>
                        </div>
                        <div className="space-y-3">
                            {topCancelled.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">No cancellations found.</p>
                            ) : topCancelled.map((salon, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 border-b border-gray-50 last:border-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-700">{salon.name}</span>
                                    </div>
                                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100">{salon.count} cancelled</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Trophy className="text-yellow-500" size={20} />
                            <h3 className="font-bold text-lg text-gray-900">Top Revenue Partners</h3>
                        </div>
                        <div className="space-y-3">
                            {topSalons.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">No data.</p>
                            ) : topSalons.map((salon, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 relative overflow-hidden hover:bg-gray-100 transition-colors">
                                    <div className={`absolute top-0 left-0 w-1 h-full ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-transparent'}`}></div>
                                    <div className="font-black text-lg text-gray-300 w-6 text-center">{idx + 1}</div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-900 text-xs truncate">{salon.name}</h4>
                                        <p className="text-[10px] text-gray-500">{salon.bookings} Sales</p>
                                    </div>
                                    <span className="font-bold text-gray-900 text-xs">₹{salon.revenue.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => navigate('/manage-salons')} className="w-full mt-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Manage Salons</button>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Star className="text-purple-500" size={20} />
                            <h3 className="font-bold text-lg text-gray-900">Top Services</h3>
                        </div>
                        <div className="space-y-3">
                            {topServices.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">No data.</p>
                            ) : topServices.map((srv, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 border-b border-gray-50 last:border-0">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">#{idx + 1}</span>
                                        <span className="text-xs font-bold text-gray-700 capitalize">{srv.name}</span>
                                    </div>
                                    <span className="text-xs font-bold text-gray-900">{srv.count} <span className="text-[9px] text-gray-400 font-normal">orders</span></span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity className="text-blue-500" size={20} />
                            <h3 className="font-bold text-lg text-gray-900">Live Activity Feed</h3>
                        </div>
                        <div className="space-y-4">
                            {activities.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">No recent activity.</p>
                            ) : activities.map((act) => (
                                <div key={act.id} className="flex gap-3 items-start">
                                    <div className={`p-2 rounded-full mt-0.5 ${act.bg} ${act.color}`}>
                                        {act.icon}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-800 leading-tight">{act.title}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(act.time)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}