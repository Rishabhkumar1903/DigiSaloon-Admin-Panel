import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase-config'; // Apne firebase path ke hisaab se adjust kar lena
import { AlertOctagon, Star, Trash2, CheckCircle, Search, Eye, X, User, MessageSquareText, FileText, Clock } from 'lucide-react';

const ReportedReviews = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Right-side Drawer state
    const [selectedReport, setSelectedReport] = useState(null);

    // Action Modal state (Reason box)
    const [actionModal, setActionModal] = useState({ isOpen: false, type: '', report: null });
    const [adminReason, setAdminReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const q = query(
            collection(db, 'reported_reviews'),
            orderBy('reportedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reportsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setReports(reportsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // --------------------------------------------------
    // HELPERS
    // --------------------------------------------------
    const formatDateTime = (timestamp) => {
        if (!timestamp) return "—";
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
        } catch (e) {
            return timestamp.toString();
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'pending_admin_action': return 'bg-orange-100 text-orange-700';
            case 'review_deleted': return 'bg-red-100 text-red-700';
            case 'dismissed_by_admin': return 'bg-gray-100 text-gray-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    // --------------------------------------------------
    // ACTION HANDLERS
    // --------------------------------------------------
    const openActionModal = (report, type) => {
        setActionModal({ isOpen: true, type, report });
        setAdminReason('');
    };

    const handleConfirmAction = async () => {
        if (!adminReason.trim()) {
            alert("Please provide a reason for this action.");
            return;
        }

        setIsProcessing(true);
        const { type, report } = actionModal;

        try {
            const statusToSet = type === 'delete' ? 'review_deleted' : 'dismissed_by_admin';

            // 🔥 NAYA JADOO: Original review document ko HAMESHA update karo (Delete ho ya Dismiss) 🔥
            await updateDoc(doc(db, 'partners', report.partnerId, 'reviews', report.reviewId), {
                status: statusToSet,
                adminReason: adminReason.trim()
            });

            // Report document ko update karo

            // Report document ko update karo
            await updateDoc(doc(db, 'reported_reviews', report.id), {
                status: statusToSet,
                adminReason: adminReason.trim(),
                actionTakenAt: new Date()
            });

            setActionModal({ isOpen: false, type: '', report: null });
            setAdminReason('');
        } catch (error) {
            console.error("Error processing action:", error);
            alert("Failed to process action.");
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredReports = reports.filter(r => 
        r.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.reviewText?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-6">Loading reports...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-screen bg-gray-50">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <AlertOctagon className="text-red-500" /> Reported Reviews
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage reviews reported by salon partners.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search by customer name or review text..." 
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-100"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                                <th className="p-4 font-semibold w-[15%]">Date</th>
                                <th className="p-4 font-semibold w-[20%]">Customer Info</th>
                                <th className="p-4 font-semibold w-[35%]">Review Content</th>
                                <th className="p-4 font-semibold w-[15%]">Status</th>
                                <th className="p-4 font-semibold w-[15%]">Admin Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredReports.map((report) => (
                                <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 text-sm text-gray-600">
                                        {report.reportedAt?.toDate ? report.reportedAt.toDate().toLocaleDateString('en-GB') : report.reportedAt}
                                    </td>
                                    
                                    <td className="p-4">
                                        <p className="font-semibold text-gray-800 truncate">{report.customerName}</p>
                                        <div className="flex items-center text-yellow-500 mt-1 text-xs font-bold">
                                            <Star size={12} className="fill-yellow-500 mr-1"/> {report.givenRating} / 5
                                        </div>
                                    </td>
                                    
                                    <td className="p-4">
                                        <p className="text-sm text-gray-700 line-clamp-2" title={report.reviewText}>
                                            {report.reviewText || "No text provided"}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-1 font-mono">ID: {report.reviewId}</p>
                                    </td>
                                    
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase w-fit ${getStatusStyle(report.status)}`}>
                                            {report.status?.replace(/_/g, ' ') || "PENDING"}
                                        </span>
                                    </td>
                                    
                                    <td className="p-4">
                                        {report.status === 'pending_admin_action' ? (
                                            <div className="flex flex-col gap-2">
                                                <button onClick={() => openActionModal(report, 'delete')} className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded flex items-center justify-center gap-1 transition shadow-sm border border-red-100">
                                                    <Trash2 size={12}/> Delete Review
                                                </button>
                                                <button onClick={() => openActionModal(report, 'ignore')} className="text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded flex items-center justify-center gap-1 transition shadow-sm border border-gray-200">
                                                    <CheckCircle size={12}/> Ignore Report
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2 items-start">
                                                <span className="text-xs text-gray-400 font-bold">Action Taken</span>
                                                <button onClick={() => setSelectedReport(report)} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                                                    <Eye size={12}/> View Details
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {filteredReports.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No reported reviews found.
                        </div>
                    )}
                </div>
            </div>

            {/* =========================================
                ACTION MODAL (REASON BOX)
            ========================================= */}
            {actionModal.isOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                {actionModal.type === 'delete' ? <Trash2 className="text-red-500"/> : <CheckCircle className="text-gray-500"/>}
                                {actionModal.type === 'delete' ? 'Delete Review' : 'Ignore Report'}
                            </h3>
                            <button onClick={() => setActionModal({ isOpen: false, type: '', report: null })} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition">
                                <X size={20}/>
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-4">
                                {actionModal.type === 'delete' 
                                    ? "You are about to delete this review permanently. Please provide a reason for the salon/records." 
                                    : "You are ignoring this report. The review will remain visible. Please provide a reason."}
                            </p>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Admin Reason / Note *</label>
                            <textarea 
                                value={adminReason}
                                onChange={(e) => setAdminReason(e.target.value)}
                                placeholder="E.g. Fake review confirmed, abusive language, or No violation found..."
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-red-300 focus:bg-white resize-none h-28"
                            />
                        </div>
                        <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
                            <button onClick={() => setActionModal({ isOpen: false, type: '', report: null })} className="px-5 py-2.5 rounded-lg text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 transition">
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmAction} 
                                disabled={isProcessing}
                                className={`px-6 py-2.5 rounded-lg text-sm font-bold text-white flex items-center transition ${actionModal.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-black'} disabled:opacity-50`}
                            >
                                {isProcessing ? "Processing..." : "Confirm Action"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================
                RIGHT DETAIL DRAWER (TICKET WALA DESIGN)
            ========================================= */}
            {selectedReport && (
                <>
                    <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px]" onClick={() => setSelectedReport(null)} />
                    <div className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[480px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300">
                        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reported Review Details</p>
                                <h2 className="mt-1 text-lg font-bold text-slate-800 font-mono text-sm break-all">ID: {selectedReport.reviewId}</h2>
                                <p className="mt-1 text-xs text-slate-400">Reported on {formatDateTime(selectedReport.reportedAt)}</p>
                            </div>
                            <button onClick={() => setSelectedReport(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 shrink-0">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-gray-50">
                            <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold uppercase ${getStatusStyle(selectedReport.status)}`}>
                                {selectedReport.status?.replace(/_/g, ' ')}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {/* CUSTOMER & RATING DETAILS */}
                            <div className="border-b border-slate-100 px-6 py-5">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><User className="text-red-500" size={16}/> Customer Info</h3>
                                <div className="grid grid-cols-[110px_1fr] gap-3 mb-3">
                                    <span className="text-xs font-medium text-slate-400">Name</span>
                                    <span className="text-sm font-medium text-slate-700">{selectedReport.customerName}</span>
                                </div>
                                <div className="grid grid-cols-[110px_1fr] gap-3">
                                    <span className="text-xs font-medium text-slate-400">Given Rating</span>
                                    <span className="text-sm font-bold text-yellow-600 flex items-center gap-1">
                                        <Star size={14} className="fill-yellow-500"/> {selectedReport.givenRating} / 5
                                    </span>
                                </div>
                            </div>

                            {/* REVIEW CONTENT */}
                            <div className="border-b border-slate-100 px-6 py-5">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><FileText className="text-blue-500" size={16}/> Review Content</h3>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                        {selectedReport.reviewText || <span className="italic text-gray-400">No text provided by customer.</span>}
                                    </p>
                                </div>
                            </div>

                            {/* ADMIN ACTION REASON (SAVED NOTE) */}
                            <div className="border-b border-slate-100 px-6 py-5">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><MessageSquareText className="text-purple-500" size={16}/> Action Details</h3>
                                <div className="grid grid-cols-[110px_1fr] gap-3 mb-4">
                                    <span className="text-xs font-medium text-slate-400">Action Time</span>
                                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                        <Clock size={14}/> {formatDateTime(selectedReport.actionTakenAt)}
                                    </span>
                                </div>
                                
                                <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                                    <p className="mb-2 text-[10px] font-bold text-yellow-800 uppercase tracking-wider">Admin Reason</p>
                                    <p className="text-sm text-yellow-900 whitespace-pre-wrap font-medium">
                                        {selectedReport.adminReason || "No reason provided during action."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ReportedReviews;