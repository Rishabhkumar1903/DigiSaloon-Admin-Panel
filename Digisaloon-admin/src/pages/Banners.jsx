import { useState, useEffect } from "react";
import { db, storage } from "../firebase-config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
    Trash2, Loader2, Smartphone, Gift
} from "lucide-react";

export default function Banners() {
    const [loading, setLoading] = useState(true);
    
    // 🔥 STATE FOR STATIC APP HEADERS (Home, Login, Referral)
    const [staticBanners, setStaticBanners] = useState({
        home: "",
        login: "",
        referral: "" // Naya Referral state add kiya
    });
    const [updatingStatic, setUpdatingStatic] = useState(false);

    // 🔥 STATES FOR UPLOADING SPINNERS
    const [isUploadingHome, setIsUploadingHome] = useState(false);
    const [isUploadingLogin, setIsUploadingLogin] = useState(false);
    const [isUploadingReferral, setIsUploadingReferral] = useState(false);

    // 1. Fetch All Data
    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Static App Config (Home, Login & Referral)
            const homeSnap = await getDoc(doc(db, "app_config", "home_screen"));
            const loginSnap = await getDoc(doc(db, "app_config", "login_screen"));
            const referralSnap = await getDoc(doc(db, "app_config", "referral_settings"));

            setStaticBanners({
                home: homeSnap.exists() ? homeSnap.data().bannerUrl : "",
                login: loginSnap.exists() ? loginSnap.data().bannerUrl : "",
                referral: referralSnap.exists() ? referralSnap.data().headerImageUrl : "" // Referral data fetch
            });

        } catch (error) {
            console.error("Error fetching data:", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // 2. UPLOAD IMAGE FOR STATIC BANNERS
    const handleStaticImageUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        if (type === 'home') setIsUploadingHome(true);
        else if (type === 'login') setIsUploadingLogin(true);
        else if (type === 'referral') setIsUploadingReferral(true);

        try {
            const imageRef = ref(storage, `app_config/${Date.now()}_${file.name}`);
            const uploadResult = await uploadBytes(imageRef, file);
            const downloadUrl = await getDownloadURL(uploadResult.ref);

            setStaticBanners(prev => ({ ...prev, [type]: downloadUrl }));
        } catch (error) {
            console.error("Error uploading static image:", error);
            alert("Failed to upload image. Please try again.");
        }

        if (type === 'home') setIsUploadingHome(false);
        else if (type === 'login') setIsUploadingLogin(false);
        else if (type === 'referral') setIsUploadingReferral(false);
    };

    // 3. UPDATE STATIC HEADER IN FIRESTORE
    const handleUpdateStatic = async (type) => {
        if (!staticBanners[type]) return alert("Please upload an image first!");
        
        setUpdatingStatic(true);
        try {
            let docId = "";
            let fieldName = "bannerUrl";

            if (type === 'home') docId = 'home_screen';
            else if (type === 'login') docId = 'login_screen';
            else if (type === 'referral') {
                docId = 'referral_settings';
                fieldName = "headerImageUrl"; // Referral collection me field ka naam alag hai tumhare screenshot ke hisaab se
            }

            await setDoc(doc(db, "app_config", docId), {
                [fieldName]: staticBanners[type]
            }, { merge: true });

            alert(`${type.toUpperCase()} Screen Banner Updated! 📲`);
        } catch (error) {
            console.error("Error updating static banner:", error);
            alert("Failed to update.");
        }
        setUpdatingStatic(false);
    };

    // 3.1 DELETE STATIC HEADER
    const handleDeleteStatic = async (type) => {
        if (!window.confirm(`Are you sure you want to delete the ${type} banner?`)) return;

        setUpdatingStatic(true);
        try {
            let docId = "";
            let fieldName = "bannerUrl";

            if (type === 'home') docId = 'home_screen';
            else if (type === 'login') docId = 'login_screen';
            else if (type === 'referral') {
                docId = 'referral_settings';
                fieldName = "headerImageUrl";
            }

            await setDoc(doc(db, "app_config", docId), {
                [fieldName]: "" // Clear the URL in Firestore
            }, { merge: true });

            setStaticBanners(prev => ({ ...prev, [type]: "" })); // Clear from UI
            alert(`${type.toUpperCase()} Screen Banner Deleted! 🗑️`);
        } catch (error) {
            console.error("Error deleting static banner:", error);
            alert("Failed to delete banner.");
        }
        setUpdatingStatic(false);
    };

    if (loading) return <div className="flex justify-center h-screen items-center"><Loader2 className="animate-spin text-purple-600" size={40}/></div>;

    return (
        <div className="p-8 bg-gray-50/50 min-h-screen">
            
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">App Visuals 🎨</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage core app headers and promotional imagery.</p>
                </div>
            </div>

            {/* 🔥 SECTION 1: STATIC APP HEADERS */}
            <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                <Smartphone className="text-purple-600"/> Main App Headers
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                
                {/* HOME SCREEN CARD */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                    <div className="flex justify-between mb-3">
                        <h4 className="font-bold text-gray-700">Home Screen Top</h4>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">LIVE</span>
                    </div>
                    <div className="aspect-video bg-gray-100 rounded-xl mb-4 overflow-hidden border border-gray-100 relative flex-grow">
                        {staticBanners.home ? (
                            <>
                                <img src={staticBanners.home} className="w-full h-full object-cover" alt="Home"/>
                                <button 
                                    onClick={() => handleDeleteStatic('home')}
                                    disabled={updatingStatic}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg shadow-md hover:bg-red-600 transition-colors disabled:opacity-50"
                                    title="Delete Home Banner"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </>
                        ) : <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Image</div>}
                    </div>
                    <div className="flex gap-2 items-center mt-auto">
                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => handleStaticImageUpload(e, 'home')}
                            disabled={isUploadingHome || updatingStatic}
                            className="flex-1 w-full max-w-[150px] p-2 border border-gray-200 rounded-lg text-xs bg-white file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer disabled:opacity-50"
                        />
                        {isUploadingHome && <Loader2 className="animate-spin text-purple-600 shrink-0" size={18}/>}
                        <button onClick={() => handleUpdateStatic('home')} disabled={updatingStatic || isUploadingHome || !staticBanners.home} className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-800 disabled:opacity-50 transition-all ml-auto">
                            {updatingStatic ? <Loader2 className="animate-spin" size={14}/> : "Update"}
                        </button>
                    </div>
                </div>

                {/* LOGIN SCREEN CARD */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                    <div className="flex justify-between mb-3">
                        <h4 className="font-bold text-gray-700">Login Screen BG</h4>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">AUTH</span>
                    </div>
                    <div className="aspect-video bg-gray-100 rounded-xl mb-4 overflow-hidden border border-gray-100 relative flex-grow">
                        {staticBanners.login ? (
                            <>
                                <img src={staticBanners.login} className="w-full h-full object-cover" alt="Login"/>
                                <button 
                                    onClick={() => handleDeleteStatic('login')}
                                    disabled={updatingStatic}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg shadow-md hover:bg-red-600 transition-colors disabled:opacity-50"
                                    title="Delete Login Banner"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </>
                        ) : <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Image</div>}
                    </div>
                    <div className="flex gap-2 items-center mt-auto">
                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => handleStaticImageUpload(e, 'login')}
                            disabled={isUploadingLogin || updatingStatic}
                            className="flex-1 w-full max-w-[150px] p-2 border border-gray-200 rounded-lg text-xs bg-white file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer disabled:opacity-50"
                        />
                        {isUploadingLogin && <Loader2 className="animate-spin text-purple-600 shrink-0" size={18}/>}
                        <button onClick={() => handleUpdateStatic('login')} disabled={updatingStatic || isUploadingLogin || !staticBanners.login} className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-800 disabled:opacity-50 transition-all ml-auto">
                            {updatingStatic ? <Loader2 className="animate-spin" size={14}/> : "Update"}
                        </button>
                    </div>
                </div>

                {/* 🔥 NEW: REFERRAL SCREEN CARD */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col border-t-4 border-t-purple-500">
                    <div className="flex justify-between mb-3">
                        <h4 className="font-bold text-gray-700 flex items-center gap-1.5"><Gift size={16} className="text-purple-500"/> Referral Banner</h4>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">PROMO</span>
                    </div>
                    <div className="aspect-video bg-gray-100 rounded-xl mb-4 overflow-hidden border border-gray-100 relative flex-grow">
                        {staticBanners.referral ? (
                            <>
                                <img src={staticBanners.referral} className="w-full h-full object-cover" alt="Referral"/>
                                <button 
                                    onClick={() => handleDeleteStatic('referral')}
                                    disabled={updatingStatic}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg shadow-md hover:bg-red-600 transition-colors disabled:opacity-50"
                                    title="Delete Referral Banner"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </>
                        ) : <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Image</div>}
                    </div>
                    <div className="flex gap-2 items-center mt-auto">
                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => handleStaticImageUpload(e, 'referral')}
                            disabled={isUploadingReferral || updatingStatic}
                            className="flex-1 w-full max-w-[150px] p-2 border border-gray-200 rounded-lg text-xs bg-white file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-800 cursor-pointer disabled:opacity-50"
                        />
                        {isUploadingReferral && <Loader2 className="animate-spin text-purple-600 shrink-0" size={18}/>}
                        <button onClick={() => handleUpdateStatic('referral')} disabled={updatingStatic || isUploadingReferral || !staticBanners.referral} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-purple-700 disabled:opacity-50 transition-all ml-auto">
                            {updatingStatic ? <Loader2 className="animate-spin" size={14}/> : "Update"}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}