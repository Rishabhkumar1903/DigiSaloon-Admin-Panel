import { useState, useEffect } from "react";
import { db } from "../firebase-config";
import { firebaseConfig } from "../firebase-config"; 
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { Search, Key, Shield, X, Eye, EyeOff, Loader, Lock, Copy, Mail, CheckCircle, Send } from "lucide-react";


export default function Credentials() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  
  // Modal State
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  // Toggle password visibility in table
  const [visiblePasswordId, setVisiblePasswordId] = useState(null);

  // 1. Fetch Verified Partners
  const fetchPartners = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "partners"));
      const data = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.status === "verified");
      setPartners(data);
    } catch (error) { console.error("Error:", error); }
    setLoading(false);
  };

  useEffect(() => { fetchPartners(); }, []);

  // 🔥 2. Create Credentials Logic
  // 🔥 2. Create or Reset Credentials Logic
  const handleCreateLogin = async () => {
    const email = selectedPartner.email || selectedPartner.ownerInfo?.email;

    // --- RESET MODE (Active Tab) ---
    if (activeTab === "active") {
        setCreating(true);
        try {
            const auth = getAuth(); // Using default app
            await sendPasswordResetEmail(auth, email);
            alert(`Password Reset Link sent to ${email} 📩\n\nPartner can now set their own new password.`);
            
            // Database me password delete kar do kyunki ab partner khud banayega
            await updateDoc(doc(db, "partners", selectedPartner.id), { 
                adminPassword: "User Reset (Private)" 
            });
            
            setSelectedPartner(null);
            fetchPartners();
        } catch (error) {
            console.error("Reset Error:", error);
            alert("Error: " + error.message);
        }
        setCreating(false);
        return; // Yahan se function wapas laut jayega
    }

    // --- CREATE MODE (Pending Tab) ---
    if (password.length < 6) return alert("Password must be at least 6 characters!");
    setCreating(true);

    let secondaryApp = null;
    try {
      secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);

      await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await signOut(secondaryAuth);

      await updateDoc(doc(db, "partners", selectedPartner.id), {
        authCreated: true,
        adminPassword: password, 
        emailSent: false, 
        lastPasswordUpdate: new Date()
      });

      alert(`Success! Login Created for ${selectedPartner.salonName}`);
      setSelectedPartner(null);
      setPassword("");
      fetchPartners(); 

    } catch (error) {
      console.error("Error creating auth:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("⚠️ Account already exists in Auth! Fixing database status...");
        await updateDoc(doc(db, "partners", selectedPartner.id), { authCreated: true });
        fetchPartners();
        setSelectedPartner(null);
      } else {
        alert("Error: " + error.message);
      }
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setCreating(false);
    }
  };

  // 📧 3. Send Email Logic
  const handleSendEmail = async (partner) => {
    if(!partner.adminPassword) return alert("Pehle Password create karein!");

    const email = partner.email || partner.ownerInfo?.email;
    const subject = encodeURIComponent("Welcome to DigiSaloon! Your Partner Account is LIVE");
    const body = encodeURIComponent(
      `Dear ${partner.ownerInfo?.name || "Partner"},\n\n` +
      `Welcome to the DigiSaloon family! We are absolutely thrilled to officially onboard "${partner.salonName || partner.basicInfo?.salonName}" as a verified Salon Partner.\n\n` +
      `Your salon is now live on our platform, opening doors to more walk-ins, smarter queue management, and a seamless digital business experience.\n\n` +
      `════════════════════════════════════════\n` +
      `YOUR SECURE LOGIN CREDENTIALS\n` +
      `(Please keep these details confidential and do not share them)\n\n` +
      `Partner ID (Username): ${email}\n` +
      `Password: ${partner.adminPassword}\n` +
      `\n` +
      `NEXT STEPS TO GROW YOUR BUSINESS:\n` +
      `1. Log In: Open the DigiSaloon Partner App and log in using the credentials above.\n` +
      `2. Update Profile: Review your dashboard, verify your services, and upload high-quality photos.\n` +
      `3. Start Managing: You are all set to receive and manage your bookings!\n\n` +
      `If you need any assistance, our dedicated partner support team is always here to help you grow. Just reply directly to this email.\n\n` +
      `Warm Regards,\n\n` +
      `Team DigiSaloon\n` +
      `www.digisaloon.in`
    );

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;

    try {
        await updateDoc(doc(db, "partners", partner.id), {
            emailSent: true,
            emailSentAt: new Date()
        });
        setPartners(prev => prev.map(p => p.id === partner.id ? { ...p, emailSent: true } : p));
    } catch (error) {
        console.error("Error updating email status:", error);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Copied!");
  };

  const filteredList = partners.filter(p => {
    const name = p.salonName || p.basicInfo?.salonName || "";
    const email = p.email || p.ownerInfo?.email || "";
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "pending") return matchesSearch && !p.authCreated;
    if (activeTab === "active") return matchesSearch && p.authCreated;
    return false;
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-gray-800">Login Credentials 🔑</h1>
        <div className="relative">
             <Search className="absolute left-3 top-3 text-gray-400" size={18} />
             <input type="text" placeholder="Search Salon..." className="pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* --- TABS --- */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 pb-1">
        <button onClick={() => setActiveTab("pending")} className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === "pending" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Pending Creation
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "pending" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>{partners.filter(p => !p.authCreated).length}</span>
        </button>
        <button onClick={() => setActiveTab("active")} className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === "active" ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Active Logins
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{partners.filter(p => p.authCreated).length}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : 
         filteredList.length === 0 ? <div className="p-12 text-center text-gray-400"><Shield size={48} className="mx-auto mb-3 opacity-20"/><p>No partners found.</p></div> : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 font-semibold text-gray-600">Salon Details</th>
                <th className="p-4 font-semibold text-gray-600">Username (Email)</th>
                {activeTab === "active" && <th className="p-4 font-semibold text-gray-600">Password</th>}
                <th className="p-4 font-semibold text-gray-600">Email Status</th>
                <th className="p-4 font-semibold text-right text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredList.map((partner) => {
                 const email = partner.email || partner.ownerInfo?.email || "No Email";
                 
                 return (
                  <tr key={partner.id} className="hover:bg-gray-50 transition-colors">
                    
                    {/* 🔥 UPDATED ID COLUMN: Full ID + Copy Button */}
                    <td className="p-4">
                        <div className="font-bold text-gray-800">{partner.salonName || partner.basicInfo?.salonName}</div>
                        <div className="mt-1 flex items-center gap-2">
                             <div className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded border border-gray-200 font-mono break-all" title={partner.id}>
                                ID: {partner.id}
                             </div>
                             <button 
                                onClick={() => copyToClipboard(partner.id)} 
                                className="text-gray-400 hover:text-blue-600 shrink-0"
                                title="Copy ID"
                             >
                                <Copy size={14} />
                             </button>
                        </div>
                    </td>

                    <td className="p-4 text-gray-600 font-mono text-sm">
                        <div className="flex items-center gap-2">
                            {email}
                            <button onClick={() => copyToClipboard(email)} className="text-gray-400 hover:text-blue-500"><Copy size={12}/></button>
                        </div>
                    </td>

                    {activeTab === "active" && (
                        <td className="p-4">
                            <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg w-fit border border-gray-200">
                                <span className="font-mono text-sm font-bold text-gray-700">
                                    {visiblePasswordId === partner.id ? (partner.adminPassword || "Unknown") : "••••••••"}
                                </span>
                                <button onClick={() => setVisiblePasswordId(visiblePasswordId === partner.id ? null : partner.id)} className="text-gray-400 hover:text-blue-600 ml-2">
                                    {visiblePasswordId === partner.id ? <EyeOff size={16}/> : <Eye size={16}/>}
                                </button>
                                {visiblePasswordId === partner.id && partner.adminPassword && (
                                    <button onClick={() => copyToClipboard(partner.adminPassword)} className="text-gray-400 hover:text-green-600"><Copy size={14}/></button>
                                )}
                            </div>
                        </td>
                    )}

                    <td className="p-4">
                        {partner.emailSent ? (
                            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex w-fit items-center gap-1 border border-blue-100">
                                <CheckCircle size={12}/> Sent
                            </span>
                        ) : (
                            <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold flex w-fit items-center gap-1">
                                <Mail size={12}/> Not Sent
                            </span>
                        )}
                    </td>

                    <td className="p-4 text-right">
                        {activeTab === "pending" ? (
                            <button onClick={() => setSelectedPartner(partner)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2 ml-auto">
                                <Key size={16}/> Create Login
                            </button>
                        ) : (
                            <div className="flex gap-2 justify-end">
                                <button 
                                    onClick={() => handleSendEmail(partner)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition-all ${partner.emailSent ? 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}
                                >
                                    <Send size={12}/> {partner.emailSent ? "Resend" : "Send Mail"}
                                </button>

                                <button onClick={() => setSelectedPartner(partner)} className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 border border-gray-200 flex items-center gap-1">
                                    <Lock size={12}/> Reset
                                </button>
                            </div>
                        )}
                    </td>
                  </tr>
                 );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 🔥 MODAL (Password) */}
      {selectedPartner && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-black text-gray-800">{activeTab === "active" ? "Reset Password" : "Set Password 🔐"}</h2>
                    <button onClick={() => setSelectedPartner(null)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                        Target Salon: <br/><span className="font-bold text-black">{selectedPartner.salonName}</span> <br/>
                        <span className="font-mono text-xs text-gray-500">{selectedPartner.email || selectedPartner.ownerInfo?.email}</span>
                    </div>
                    
                    {/* 👇 CONDITION LAGAYI HAI YAHAN 👇 */}
                    {activeTab === "pending" ? (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">New Password</label>
                            <div className="relative mt-1">
                                <input type={showPasswordInput ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter strong password" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pr-10"/>
                                <button onClick={() => setShowPasswordInput(!showPasswordInput)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">{showPasswordInput ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-sm text-yellow-800">
                           ⚠️ <b>Note:</b> For security, you cannot manually set a password for an active user. Click "Reset" to send an official password reset link to their email.
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={() => setSelectedPartner(null)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg">Cancel</button>
                    <button onClick={handleCreateLogin} disabled={creating} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 disabled:bg-gray-400">
                        {creating ? <Loader className="animate-spin" size={18}/> : <><Key size={18}/> {activeTab === "active" ? "Reset" : "Create"}</>}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}