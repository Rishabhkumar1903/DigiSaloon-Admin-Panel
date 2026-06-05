import { useState, useEffect } from "react";
import { db } from "../firebase-config";
import { collectionGroup, getDocs, query, orderBy } from "firebase/firestore";
import {
    IndianRupee, Calendar, TrendingUp, Search,
    Users, Ticket, Building2, Filter, Download
} from "lucide-react";

export default function Revenue() {
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFilter, setDateFilter] = useState("All");
    const [customDate, setCustomDate] = useState("");

    // Stats
    const [stats, setStats] = useState({
        totalRevenue: 0,
        monthlyCount: 0,
        quarterlyCount: 0,
        founderCount: 0
    });

    const loadRevenueData = async () => {
        setLoading(true);
        try {
            // Hum sabhi salons ki 'subscription_history' fetch kar rahe hain
            // Dhyan rakhein: Iske liye Firebase rules me collectionGroup allow karna padega
            const q = query(collectionGroup(db, "subscription_history"), orderBy("activatedAt", "desc"));
            const snapshot = await getDocs(q);

            let totalRev = 0;
            let mCount = 0;
            let qCount = 0;
            let fCount = 0;

            const dataList = snapshot.docs.map(doc => {
                const d = doc.data();
                const amount = Number(d.amountPaid || 0);
                const plan = d.planType || "Unknown";

                // Stats calculation
                totalRev += amount;
                if (plan.toLowerCase().includes("month")) mCount++;
                else if (plan.toLowerCase().includes("quarter")) qCount++;
                else if (plan.toLowerCase().includes("founder")) fCount++;

                return {
                    id: doc.id,
                    salonName: d.salonName || "Unknown Salon",
                    amount: amount,
                    planType: plan,
                    date: d.activatedAt ? d.activatedAt.toDate() : new Date(),
                    validUntil: d.validUntil ? d.validUntil.toDate() : null,
                    method: d.paymentMethod || "Manual",
                    transactionId: d.transactionId || "N/A"
                };
            });

            setHistory(dataList);
            setStats({
                totalRevenue: totalRev,
                monthlyCount: mCount,
                quarterlyCount: qCount,
                founderCount: fCount
            });

        } catch (error) {
            console.error("Error fetching revenue:", error);
            // Agar collectionGroup ka index missing hoga, toh console me error aayega
        }
        setLoading(false);
    };

    useEffect(() => { loadRevenueData(); }, []);

    // Date Filtering Logic
    const filteredHistory = history.filter(item => {
        if (searchTerm && !item.salonName.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
        }

        const today = new Date();
        const itemDate = item.date;

        if (dateFilter === "Today") {
            return itemDate.toDateString() === today.toDateString();
        }
        else if (dateFilter === "Yesterday") {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return itemDate.toDateString() === yesterday.toDateString();
        }
        else if (dateFilter === "This Month") {
            return itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
        }
        else if (dateFilter === "Custom" && customDate) {
            const selected = new Date(customDate);
            return itemDate.toDateString() === selected.toDateString();
        }
        return true; // "All"
    });


    // 🔥 DYNAMIC STATS CALCULATION
    let dynamicTotalRev = 0;
    let dynamicMCount = 0;
    let dynamicQCount = 0;
    let dynamicYCount = 0; // 🔥 Naya variable Yearly ke liye

    filteredHistory.forEach(item => {
        dynamicTotalRev += item.amount;
        const plan = item.planType.toLowerCase();

        if (plan.includes("month")) dynamicMCount++;
        else if (plan.includes("quarter")) dynamicQCount++;
        else if (plan.includes("year")) dynamicYCount++; // 🔥 Yearly ko alag kar diya
    });

    // 🔥 CSV Export Logic
    const exportToCSV = () => {
        if (filteredHistory.length === 0) {
            alert("No data to export!");
            return;
        }

        const headers = ["Date", "Time", "Salon Name", "Plan Type", "Amount Paid", "Valid Until", "Payment Method", "Transaction ID"];

        const rows = filteredHistory.map(item => {
            const dateStr = item.date ? item.date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "N/A";
            const timeStr = item.date ? item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A";
            const validStr = item.validUntil ? item.validUntil.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "N/A";

            return [
                `"${dateStr}"`,
                `"${timeStr}"`,
                `"${item.salonName}"`,
                `"${item.planType}"`,
                item.amount,
                `"${validStr}"`,
                `"${item.method}"`,
                `"${item.transactionId}"`
            ];
        });

        // CSV Format ready karna
        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n")
            + `\n,,,,,,TOTAL REVENUE,${stats.totalRevenue}`; // Niche total bhi dikhayega

        // Download trigger karna
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `DigiSaloon_Revenue_${dateFilter.replace(/ /g, "_")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-8 bg-gray-50/50 min-h-screen">

            {/* HEADER & DATE FILTERS */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Revenue & Billing 💳</h1>
                    <p className="text-sm text-gray-500 mt-1">Track lifetime subscription collections & plans.</p>
                </div>

                <div className="flex flex-wrap items-center bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                    {["All", "Today", "Yesterday", "This Month"].map(filter => (
                        <button
                            key={filter}
                            onClick={() => { setDateFilter(filter); setCustomDate(""); }}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${dateFilter === filter && !customDate ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                        >
                            {filter}
                        </button>
                    ))}

                    {/* 🔥 Naya Date Picker yahan hai */}
                    <div className="relative flex items-center border-l border-gray-200 pl-2 ml-1">
                        <input
                            type="date"
                            value={customDate}
                            onChange={(e) => {
                                setCustomDate(e.target.value);
                                setDateFilter("Custom");
                            }}
                            className={`px-3 py-1.5 text-sm font-bold rounded-lg outline-none cursor-pointer transition-all ${customDate ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 bg-transparent'}`}
                        />
                    </div>
                </div>
            </div>

            {/* REVENUE STATS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-7xl mx-auto mb-10">
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl shadow-md text-white relative overflow-hidden">
                    <TrendingUp size={80} className="absolute -right-4 -bottom-4 opacity-20" />
                    <p className="font-bold text-green-100 text-xs uppercase tracking-wider mb-1">Total Lifetime Revenue</p>
                    <p className="text-4xl font-black">₹{dynamicTotalRev.toLocaleString()}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-2 text-blue-600 mb-2"><Calendar size={18} /><span className="font-bold text-xs uppercase">Monthly Plans</span></div>
                    <p className="text-3xl font-black text-gray-900">{dynamicMCount} <span className="text-sm font-medium text-gray-500">salons</span></p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-2 text-purple-600 mb-2"><Building2 size={18} /><span className="font-bold text-xs uppercase">Quarterly Plans</span></div>
                    <p className="text-3xl font-black text-gray-900">{dynamicQCount} <span className="text-sm font-medium text-gray-500">salons</span></p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-2 text-orange-600 mb-2"><Calendar size={18} /><span className="font-bold text-xs uppercase">Yearly Plans</span></div>
                    <p className="text-3xl font-black text-gray-900">{dynamicYCount} <span className="text-sm font-medium text-gray-500">salons</span></p>
                </div>

            </div>

            {/* BILLING LEDGER TABLE */}
            <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-4 items-center bg-gray-50/30">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><IndianRupee size={20} /> Billing Ledger</h2>

                    <div className="flex gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input type="text" placeholder="Search Salon..." className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 w-full outline-none text-sm" onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 rounded-xl font-bold text-sm transition-all shadow-sm">
                            <Download size={16} /> Export
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Salon Name</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Plan Type</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount Paid</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Valid Until</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Method/Txn ID</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-400 font-bold">Loading Ledger...</td></tr>
                            ) : filteredHistory.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-400 font-bold">No billing history found for this period.</td></tr>
                            ) : (
                                filteredHistory.map((item) => (
                                    <tr key={item.id} className="hover:bg-blue-50/10 transition-colors">
                                        <td className="p-4 align-middle">
                                            <div className="font-bold text-sm text-gray-900">{item.date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                            <div className="text-xs text-gray-500">{item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="p-4 align-middle font-bold text-gray-800">{item.salonName}</td>
                                        <td className="p-4 align-middle">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${item.planType.toLowerCase().includes('founder') ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {item.planType}
                                            </span>
                                        </td>
                                        <td className="p-4 align-middle text-green-600 font-black text-lg">₹{item.amount.toLocaleString()}</td>
                                        <td className="p-4 align-middle text-sm font-medium text-gray-600">
                                            {item.validUntil ? item.validUntil.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "N/A"}
                                        </td>
                                        <td className="p-4 align-middle text-right">
                                            <div className="text-sm font-bold text-gray-800">{item.method}</div>
                                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">{item.transactionId}</div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}