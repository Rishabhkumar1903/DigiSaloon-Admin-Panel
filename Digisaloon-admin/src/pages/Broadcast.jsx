import { useState, useEffect } from "react";
import { db, storage } from "../firebase-config"; // 🔥 storage import add kiya
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"; // 🔥 storage functions
import { BellRing, Send, Loader2, Users, Scissors, Image as ImageIcon } from "lucide-react";

export default function Broadcast() {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [history, setHistory] = useState([]);
    
    // 🔥 NEW STATE FOR IMAGE UPLOAD
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    
    const [notification, setNotification] = useState({
        target: 'users', // 'users' or 'partners'
        title: '',
        message: '',
        imageUrl: ''
    });

    const fetchHistory = async () => {
        setFetching(true);
        try {
            const q = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error fetching broadcasts:", error);
        }
        setFetching(false);
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    // 🔥 NEW: Handle Direct Image Upload
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploadingImage(true);
        try {
            const imageRef = ref(storage, `broadcasts/${Date.now()}_${file.name}`);
            const uploadResult = await uploadBytes(imageRef, file);
            const downloadUrl = await getDownloadURL(uploadResult.ref);

            // Upload hone ke baad imageUrl state me set kar do
            setNotification(prev => ({ ...prev, imageUrl: downloadUrl }));
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Failed to upload image. Please try again.");
        }
        setIsUploadingImage(false);
    };

    const handleSendNotification = async (e) => {
        e.preventDefault();
        if (!notification.title || !notification.message) {
            return alert("Title and Message are required!");
        }

        if (!window.confirm(`Are you sure you want to send this to all ${notification.target}?`)) return;

        setLoading(true);
        try {
            await addDoc(collection(db, "broadcasts"), {
                target: notification.target,
                title: notification.title,
                message: notification.message,
                imageUrl: notification.imageUrl,
                createdAt: serverTimestamp(),
                status: 'Sent'
            });

            alert("Broadcast saved successfully! 🚀 (Cloud Function will deliver it)");
            
            // File input field ko reset karne ke liye
            const fileInput = document.getElementById('broadcast-image-upload');
            if (fileInput) fileInput.value = '';

            setNotification({ target: 'users', title: '', message: '', imageUrl: '' });
            fetchHistory();
        } catch (error) {
            console.error("Error sending broadcast:", error);
            alert("Failed to send broadcast.");
        }
        setLoading(false);
    };

    return (
        <div className="p-8 bg-gray-50/50 min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Broadcast 📢</h1>
                    <p className="text-sm text-gray-500 mt-1">Send push notifications to your customers and partners.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* LEFT: COMPOSER FORM */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2">
                        <BellRing className="text-blue-500"/> Compose Message
                    </h3>
                    
                    <form onSubmit={handleSendNotification} className="space-y-5">
                        
                        {/* Target Audience */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Target Audience</label>
                            <div className="flex gap-4">
                                <button type="button" onClick={() => setNotification({...notification, target: 'users'})} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm transition-all ${notification.target === 'users' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                                    <Users size={18}/> All Customers
                                </button>
                                <button type="button" onClick={() => setNotification({...notification, target: 'partners'})} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm transition-all ${notification.target === 'partners' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                                    <Scissors size={18}/> All Partners
                                </button>
                            </div>
                        </div>

                        {/* Title */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Notification Title*</label>
                            <input type="text" maxLength={50} placeholder="e.g. 💇‍♀️ Weekend Special Offer!" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={notification.title} onChange={(e) => setNotification({...notification, title: e.target.value})} required/>
                        </div>

                        {/* Message */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Message Body*</label>
                            <textarea rows={3} maxLength={150} placeholder="e.g. Get 20% off on all Haircuts this Sunday. Book now!" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none" value={notification.message} onChange={(e) => setNotification({...notification, message: e.target.value})} required/>
                        </div>

                        {/* 🔥 UPDATED: Image Upload + URL Input */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 mb-2">
                                Image Attachment (Optional) 
                                {isUploadingImage && <Loader2 className="animate-spin text-blue-500" size={14}/>}
                            </label>
                            
                            <div className="flex flex-col gap-3">
                                {/* Upload Button */}
                                <input 
                                    id="broadcast-image-upload"
                                    type="file" 
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={isUploadingImage}
                                    className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
                                />

                                <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                                    <hr className="flex-1 border-gray-200" /> OR PASTE LINK <hr className="flex-1 border-gray-200" />
                                </div>

                                {/* URL Input */}
                                <div className="relative">
                                    <ImageIcon size={18} className="absolute left-3 top-3.5 text-gray-400"/>
                                    <input 
                                        type="url" 
                                        placeholder="https://..." 
                                        className="w-full pl-10 p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm bg-white" 
                                        value={notification.imageUrl} 
                                        onChange={(e) => setNotification({...notification, imageUrl: e.target.value})}
                                    />
                                </div>

                                {/* Small Image Preview if URL exists */}
                                {notification.imageUrl && (
                                    <div className="mt-2 relative w-24 h-16 rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                                        <img src={notification.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                        <button 
                                            type="button"
                                            onClick={() => setNotification({...notification, imageUrl: ''})} 
                                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-500"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit */}
                        <button type="submit" disabled={loading || isUploadingImage} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all disabled:opacity-70">
                            {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                            Send Broadcast Now
                        </button>
                    </form>
                </div>

                {/* RIGHT: HISTORY */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                    <h3 className="font-bold text-lg text-gray-800 mb-6">Recent Broadcasts</h3>
                    
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        {fetching ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400"/></div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 italic text-sm">No broadcasts sent yet.</div>
                        ) : (
                            history.map((item) => (
                                <div key={item.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex gap-4 hover:bg-gray-100 transition-colors">
                                    <div className={`p-3 rounded-full h-fit ${item.target === 'users' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                        {item.target === 'users' ? <Users size={20}/> : <Scissors size={20}/>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-gray-900 truncate pr-2">{item.title}</h4>
                                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                                {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-600 line-clamp-2 mb-2">{item.message}</p>
                                        {item.imageUrl && (
                                            <div className="mt-1 w-full max-w-[200px] h-24 rounded-lg overflow-hidden border border-gray-200">
                                                <img src={item.imageUrl} alt="promo" className="w-full h-full object-cover"/>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}