import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase-config'; // Apne path ke hisaab se adjust karein
import { Wallet, Search, CheckCircle, Clock, FileText, Store, Edit3, X, Save, IndianRupee, AlertCircle } from 'lucide-react';

const Settlements = () => {
    // Top-Level States (Partners List)
    const [partners, setPartners] = useState([]);
    const [loadingPartners, setLoadingPartners] = useState(true);
    const [searchPartner, setSearchPartner] = useState('');
    const [selectedPartner, setSelectedPartner] = useState(null);

    // Sub-Level States (Settlements for selected partner)
    const [partnerSettlements, setPartnerSettlements] = useState([]);
    const [loadingSettlements, setLoadingSettlements] = useState(false);
    
    // Editing States (Editing a specific settlement)
    const [editingSettlementId, setEditingSettlementId] = useState(null);
    const [editStatus, setEditStatus] = useState('');
    const [editUTR, setEditUTR] = useState('');
    const [editPayoutId, setEditPayoutId] = useState('');
    const [saving, setSaving] = useState(false);

    // 1. Fetch All Partners (Salons) initially
    useEffect(() => {
        const fetchPartners = async () => {
            try {
                const q = query(collection(db, 'partners'));
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map(doc => {
                    const data = doc.data();
                    
                    // 🔥 NAYA JADOO: Address object ko string me convert karna 🔥
                    let formattedAddress = 'Address not provided';
                    if (data.address) {
                        if (typeof data.address === 'string') {
                            formattedAddress = data.address; // Agar string hai to theek hai
                        } else if (typeof data.address === 'object') {
                            // Agar object hai to area, city aur pincode ko jod do
                            const parts = [];
                            if (data.address.area) parts.push(data.address.area);
                            if (data.address.city) parts.push(data.address.city);
                            if (data.address.pincode) parts.push(data.address.pincode);
                            formattedAddress = parts.length > 0 ? parts.join(', ') : 'Address not provided';
                        }
                    }

                    return {
                        id: doc.id,
                        salonName: data.basicInfo?.salonName || 'Unknown Salon',
                        ownerName: data.ownerInfo?.ownerName || 'Unknown Owner',
                        phone: data.ownerInfo?.phone || '',
                        address: formattedAddress 
                    };
                });
                // Sort alphabetically by salon name
                list.sort((a, b) => a.salonName.localeCompare(b.salonName));
                setPartners(list);
            } catch (error) {
                console.error("Error fetching partners:", error);
            } finally {
                setLoadingPartners(false);
            }
        };

        fetchPartners();
    }, []);

    // 2. Fetch Settlements Real-time when a partner is selected
    useEffect(() => {
        if (!selectedPartner) {
            setPartnerSettlements([]);
            return;
        }

        setLoadingSettlements(true);
        // Cancel editing mode if switching partners
        setEditingSettlementId(null);

        const q = query(
            collection(db, `partners/${selectedPartner.id}/settlements`), 
            orderBy('timestamp', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPartnerSettlements(list);
            setLoadingSettlements(false);
        }, (error) => {
            console.error("Error fetching settlements:", error);
            setLoadingSettlements(false);
        });

        return () => unsubscribe();
    }, [selectedPartner]);

    // 3. Filter Partners based on Search
    const filteredPartners = partners.filter(p => 
        p.salonName.toLowerCase().includes(searchPartner.toLowerCase()) ||
        p.id.toLowerCase().includes(searchPartner.toLowerCase())
    );

    // 4. Handle Edit Initiation
    const startEditing = (settlement) => {
        setEditingSettlementId(settlement.id);
        setEditStatus(settlement.status || 'Pending');
        setEditUTR(settlement.utr || '');
        setEditPayoutId(settlement.payoutId || '');
    };

    const cancelEditing = () => {
        setEditingSettlementId(null);
    };

    // 5. Save Edits to Firestore
    const handleSave = async (settlementId) => {
        if (!selectedPartner) return;
        setSaving(true);
        try {
            const ref = doc(db, `partners/${selectedPartner.id}/settlements`, settlementId);
            await updateDoc(ref, {
                status: editStatus,
                utr: editUTR,
                payoutId: editPayoutId
            });
            setEditingSettlementId(null);
        } catch (error) {
            console.error("Error updating settlement:", error);
            alert("Failed to update settlement details.");
        } finally {
            setSaving(false);
        }
    };

    // Helpers
    const getStatusStyle = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'processed' || s === 'completed' || s === 'success') return 'bg-green-100 text-green-800 border-green-200';
        if (s === 'failed' || s === 'rejected') return 'bg-red-100 text-red-800 border-red-200';
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'; // Pending
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        try {
            const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return 'Invalid Date';
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] bg-gray-50 p-6 overflow-hidden gap-6">
            
            {/* LEFT PANEL: LIST OF SALONS (PARTNERS) */}
            <div className="w-1/3 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-2 mb-4">
                        <Store className="text-red-600" size={24} />
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Salons</h2>
                            <p className="text-xs text-gray-500">Select a salon to view settlements</p>
                        </div>
                    </div>
                    
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search salon name..." 
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500 transition-colors"
                            value={searchPartner}
                            onChange={(e) => setSearchPartner(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                    {loadingPartners ? (
                        <div className="text-center text-gray-400 mt-10 text-sm">Loading Salons...</div>
                    ) : filteredPartners.length === 0 ? (
                        <div className="text-center text-gray-400 mt-10 text-sm">No salons found.</div>
                    ) : (
                        filteredPartners.map((partner) => (
                            <button 
                                key={partner.id}
                                onClick={() => setSelectedPartner(partner)}
                                className={`w-full text-left p-4 rounded-xl mb-2 transition-all border flex items-center gap-3 ${selectedPartner?.id === partner.id ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-100'}`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${selectedPartner?.id === partner.id ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                    <Store size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-sm font-bold text-gray-800 truncate">{partner.salonName}</h4>
                                    <p className="text-xs text-gray-500 truncate">{partner.ownerName}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>


            {/* RIGHT PANEL: SETTLEMENTS LIST FOR SELECTED SALON */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 h-full overflow-hidden flex flex-col">
                {!selectedPartner ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <Wallet size={48} className="mb-4 text-gray-200" />
                        <p className="font-medium text-gray-500">Select a salon from the left to view payouts.</p>
                    </div>
                ) : (
                    <>
                       {/* Header for Right Panel */}
                        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">{selectedPartner.salonName}</h3>
                                <p className="text-xs text-gray-500 font-mono mb-1">ID: {selectedPartner.id}</p>
                                {/* 🔥 NAYA JADOO: Address yahan dikhega 🔥 */}
                                <p className="text-xs font-medium text-gray-600 max-w-md " title={selectedPartner.address}>
                                    📍 {selectedPartner.address}
                                </p>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 flex items-center gap-1.5 shadow-sm">
                                <IndianRupee size={14} className="text-green-600" />
                                Settlement History
                            </div>
                        </div>

                        {/* List of Settlements */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                            {loadingSettlements ? (
                                <div className="text-center text-gray-400 mt-10 text-sm">Loading settlements...</div>
                            ) : partnerSettlements.length === 0 ? (
                                <div className="text-center flex flex-col items-center justify-center h-40">
                                    <FileText size={32} className="text-gray-300 mb-2" />
                                    <p className="text-gray-400 text-sm">No settlement records found for this salon.</p>
                                </div>
                            ) : (
                                partnerSettlements.map((settlement) => {
                                    const isEditingThis = editingSettlementId === settlement.id;
                                    
                                    return (
                                        <div key={settlement.id} className="bg-white border border-gray-200 rounded-xl p-5 mb-4 shadow-sm hover:shadow-md transition-shadow">
                                            
                                            {/* Top Summary Row */}
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-sm font-black text-gray-800">₹{settlement.amount || 0}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded text-xs font-bold border uppercase tracking-wider ${getStatusStyle(settlement.status)}`}>
                                                            {settlement.status || 'Pending'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-gray-400 font-mono">ID: {settlement.id}</p>
                                                </div>
                                                
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500 font-medium mb-0.5 flex items-center justify-end gap-1"><Clock size={12}/> {formatDate(settlement.timestamp)}</p>
                                                    <p className="text-[10px] text-gray-400">Target: {settlement.date || 'N/A'}</p>
                                                </div>
                                            </div>

                                            {/* Bank & Calculation Details (Compact) */}
                                            <div className="bg-gray-50 rounded-lg p-3 mb-4 flex flex-wrap gap-4 text-xs border border-gray-100">
                                                <div><span className="text-gray-400 block mb-0.5">Bank Name</span><span className="font-semibold text-gray-700">{settlement.bankName || 'Not Provided'}</span></div>
                                                <div><span className="text-gray-400 block mb-0.5">Gross Amt</span><span className="font-semibold text-gray-700">₹{settlement.grossAmount || 0}</span></div>
                                                <div><span className="text-gray-400 block mb-0.5">Fee</span><span className="font-semibold text-gray-700">₹{settlement.gatewayFee || 0}</span></div>
                                                <div><span className="text-gray-400 block mb-0.5">TDS</span><span className="font-semibold text-gray-700">₹{settlement.tdsDeducted || 0}</span></div>
                                            </div>

                                            {/* Editable Transaction Section */}
                                            {!isEditingThis ? (
                                                <div className="flex justify-between items-end border-t border-gray-100 pt-4 mt-2">
                                                    <div className="flex gap-6">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Payout ID</span>
                                                            <span className="text-sm font-semibold text-gray-800">{settlement.payoutId || '-'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">UTR Number</span>
                                                            <span className="text-sm font-mono font-semibold text-gray-800">{settlement.utr || '-'}</span>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => startEditing(settlement)}
                                                        className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                                    >
                                                        <Edit3 size={14} /> Edit Status
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="border-t border-blue-100 bg-blue-50/30 p-4 -mx-5 -mb-5 rounded-b-xl mt-2">
                                                    <div className="grid grid-cols-3 gap-4 mb-4">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Status</label>
                                                            <select 
                                                                value={editStatus}
                                                                onChange={(e) => setEditStatus(e.target.value)}
                                                                className="w-full p-2 border border-blue-200 rounded bg-white text-xs font-semibold outline-none focus:border-blue-500"
                                                            >
                                                                <option value="Pending">Pending</option>
                                                                <option value="Success">Success</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Payout ID</label>
                                                            <input 
                                                                type="text"
                                                                value={editPayoutId}
                                                                onChange={(e) => setEditPayoutId(e.target.value)}
                                                                placeholder="pout_xxx"
                                                                className="w-full p-2 border border-blue-200 rounded bg-white text-xs font-semibold outline-none focus:border-blue-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">UTR Number</label>
                                                            <input 
                                                                type="text"
                                                                value={editUTR}
                                                                onChange={(e) => setEditUTR(e.target.value)}
                                                                placeholder="Bank Ref No."
                                                                className="w-full p-2 border border-blue-200 rounded bg-white text-xs font-mono font-semibold outline-none focus:border-blue-500"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={cancelEditing}
                                                            disabled={saving}
                                                            className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            onClick={() => handleSave(settlement.id)}
                                                            disabled={saving}
                                                            className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 rounded shadow-sm hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1"
                                                        >
                                                            {saving ? 'Saving...' : <><Save size={12}/> Save</>}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Settlements;