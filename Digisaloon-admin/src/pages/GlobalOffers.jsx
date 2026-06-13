import { useState, useEffect } from "react";
import { db } from "../firebase-config";
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { Gift, Plus, Trash2, Tag, Percent, IndianRupee, Loader2 } from "lucide-react";

export default function GlobalOffers() {
    const [promoCodes, setPromoCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form States
    const [newPromo, setNewPromo] = useState({ 
        code: "", 
        type: "percentage", 
        value: "", 
        minOrder: "", 
        maxDiscount: "" 
    });

    // 1. Fetch Global Promo Codes
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "promo_codes"), (snapshot) => {
            const codes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Naye codes pehle dikhane ke liye sort kar rahe hain
            codes.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setPromoCodes(codes);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching global promos:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 2. Add New Global Promo Code
    const handleAddPromoCode = async () => {
        if (!newPromo.code.trim() || !newPromo.value || !newPromo.minOrder) {
            return alert("Code, Discount Value, and Min Order are required!");
        }

        setIsSaving(true);
        try {
            const cleanCode = newPromo.code.trim().toUpperCase();
            const dataToSave = {
                discountType: newPromo.type,
                discountValue: Number(newPromo.value),
                minOrderValue: Number(newPromo.minOrder),
                maxDiscount: newPromo.type === 'percentage' && newPromo.maxDiscount ? Number(newPromo.maxDiscount) : null,
                isActive: true,
                isGlobal: true, // Marker for analytics
                createdAt: serverTimestamp()
            };

            await setDoc(doc(db, "promo_codes", cleanCode), dataToSave, { merge: true });
            
            alert("Global Promo Code is now LIVE! 🎉");
            setNewPromo({ code: "", type: "percentage", value: "", minOrder: "", maxDiscount: "" });
        } catch (error) {
            console.error(error);
            alert("Failed to add promo code.");
        }
        setIsSaving(false);
    };

    // 3. Delete Promo Code
    const handleDeletePromo = async (promoId) => {
        if (!window.confirm(`Are you sure you want to delete global code: ${promoId}?`)) return;
        try {
            await deleteDoc(doc(db, "promo_codes", promoId));
        } catch (error) {
            console.error(error);
            alert("Failed to delete promo code.");
        }
    };

    return (
        <div className="p-8 bg-gray-50/50 min-h-screen">
            {/* Header */}
            <div className="mb-8 max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                    <Gift className="text-blue-600" size={32} /> Global Offers & Promos
                </h1>
                <p className="text-sm text-gray-500 mt-2">Create and manage discount codes that apply to all salons across the platform.</p>
            </div>

            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT COLUMN: ADD NEW PROMO FORM */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm sticky top-8">
                        <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
                            <Plus size={18} className="text-blue-500" /> Create New Code
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase mb-1 block">Coupon Code</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. DIGI50" 
                                    className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 uppercase bg-gray-50" 
                                    value={newPromo.code} 
                                    onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })} 
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase mb-1 block">Discount Type</label>
                                <div className="flex gap-2">
                                    <button 
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold border flex items-center justify-center gap-1 transition-all ${newPromo.type === 'percentage' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}
                                        onClick={() => setNewPromo({ ...newPromo, type: "percentage" })}
                                    >
                                        <Percent size={14} /> % Off
                                    </button>
                                    <button 
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold border flex items-center justify-center gap-1 transition-all ${newPromo.type === 'flat' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}
                                        onClick={() => setNewPromo({ ...newPromo, type: "flat" })}
                                    >
                                        <IndianRupee size={14} /> Flat ₹
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase mb-1 block">
                                    {newPromo.type === 'percentage' ? 'Discount Percentage (%)' : 'Flat Discount Amount (₹)'}
                                </label>
                                <input 
                                    type="number" 
                                    placeholder={newPromo.type === 'percentage' ? "e.g. 20" : "e.g. 150"} 
                                    className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" 
                                    value={newPromo.value} 
                                    onChange={e => setNewPromo({ ...newPromo, value: e.target.value })} 
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase mb-1 block">Min Order Value (₹)</label>
                                <input 
                                    type="number" 
                                    placeholder="e.g. 500" 
                                    className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" 
                                    value={newPromo.minOrder} 
                                    onChange={e => setNewPromo({ ...newPromo, minOrder: e.target.value })} 
                                />
                            </div>

                            {newPromo.type === 'percentage' && (
                                <div>
                                    <label className="text-[11px] font-bold text-gray-500 uppercase mb-1 block">Max Discount Allowed (₹)</label>
                                    <input 
                                        type="number" 
                                        placeholder="Optional. e.g. 200" 
                                        className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" 
                                        value={newPromo.maxDiscount} 
                                        onChange={e => setNewPromo({ ...newPromo, maxDiscount: e.target.value })} 
                                    />
                                </div>
                            )}

                            <button 
                                onClick={handleAddPromoCode} 
                                disabled={isSaving} 
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold flex justify-center items-center shadow-lg shadow-blue-200 transition-all mt-4"
                            >
                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : "Publish Global Code"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: ACTIVE PROMO CODES LIST */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-5 bg-gray-50/50 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Active Global Codes</h3>
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{promoCodes.length} Active</span>
                        </div>
                        
                        {loading ? (
                            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
                        ) : promoCodes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-16 text-center">
                                <div className="bg-blue-50 p-4 rounded-full mb-4">
                                    <Tag size={32} className="text-blue-300" />
                                </div>
                                <p className="text-lg font-bold text-gray-900">No Global Codes Yet</p>
                                <p className="text-sm text-gray-500 mt-1 max-w-xs">Create your first platform-wide discount code using the form to boost sales.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {promoCodes.map((promo) => (
                                    <div key={promo.id} className="p-5 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="h-14 w-14 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                                                <Tag size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-extrabold text-gray-900 text-xl tracking-wide">{promo.id}</h4>
                                                    <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">Live</span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                        {promo.discountType === 'percentage' ? `${promo.discountValue}% OFF` : `FLAT ₹${promo.discountValue} OFF`}
                                                    </span>
                                                    <span className="text-sm text-gray-500 font-medium">
                                                        Min Order: ₹{promo.minOrderValue}
                                                    </span>
                                                    {promo.maxDiscount && (
                                                        <span className="text-sm text-gray-500 font-medium">
                                                            • Max Off: ₹{promo.maxDiscount}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDeletePromo(promo.id)} 
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            title="Delete Promo Code"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}