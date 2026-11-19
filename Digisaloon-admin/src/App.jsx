import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link, Outlet } from "react-router-dom";
import { auth, db } from "./firebase-config";
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// Icons Import
import {
  LayoutDashboard, Scissors, CreditCard, Image as ImageIcon, LogOut,
  Key, Calendar, Store, User, Tag, AlertOctagon, Wallet, Ticket
} from "lucide-react";

// Pages Import
import Partners from "./pages/Partners";
import Credentials from "./pages/Credentials";
import Bookings from "./pages/Bookings";
import Payments from "./pages/Subscriptions";
import ManageSalons from "./pages/ManageSalons";
import Dashboard from "./pages/Dashboard";
import UserPage from "./pages/Users";
import Banners from "./pages/Banners";
import Broadcast from "./pages/Broadcast";
import SupportTickets from "./pages/SupportTickets";
import ReportedReviews from "./pages/ReportedReviews";
import Settlements from "./pages/Settlements";
import Billing from "./pages/Billing";
import GlobalOffers from "./pages/GlobalOffers";

// --- 1. Login Component ---
const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Invalid Email or Password");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#800000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-10 rounded-3xl shadow-2xl">
        <h2 className="text-4xl font-black text-center text-gray-800 mb-2">DigiSaloon</h2>
        <p className="text-center text-gray-400 mb-10 font-medium tracking-wide uppercase text-xs">Super Admin Portal</p>
        {error && <p className="bg-red-50 text-red-500 p-4 rounded-xl mb-6 text-sm font-bold text-center border border-red-100">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-6">
          <input type="email" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all" placeholder="Admin Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading} className="w-full bg-[#dc2626] text-white p-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-red-200 active:scale-95 transition-all disabled:bg-gray-300">
            {loading ? "Verifying..." : "Login to Control Room"}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- 2. Dashboard Layout (with Outlet) ---
const DashboardLayout = () => {
  const menuItems = [
    { name: "Dashboard", icon: <LayoutDashboard size={20} />, path: "/" },
    { name: "Partners", icon: <Scissors size={20} />, path: "/partners" },
    { name: "Credentials", icon: <Key size={20} />, path: "/credentials" },
    { name: "Settlements", icon: <Wallet size={20} />, path: "/settlements" },
    { name: "Bookings", icon: <CreditCard size={20} />, path: "/bookings" },
    { name: "Subscriptions", icon: <Calendar size={20} />, path: "/subscriptions" },
    { name: "Manage Salons", icon: <Store size={20} />, path: "/manage-salons" },
    { name: "Billing", icon: <CreditCard size={20} />, path: "/billing" },
    { name: "Broadcast", icon: <Ticket size={20} />, path: "/broadcast" },
    { name: "Users", icon: <User size={20} />, path: "/users" },
    { name: "Banners", icon: <ImageIcon size={20} />, path: "/banners" },
    { name: "Global Offers", icon: <Tag size={20} />, path: "/global-offers" },
    { name: "Support Tickets", icon: <Ticket size={20} />, path: "/support-tickets" },
    { name: "Reported Reviews", icon: <AlertOctagon size={20} />, path: "/reported-reviews" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-screen z-10">
        <div className="p-6 shrink-0">
          <h1 className="text-2xl font-black text-red-600 italic">DigiSaloon</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 pb-4 overflow-y-auto hide-scrollbar">
          {menuItems.map((item) => (
            <Link key={item.name} to={item.path} className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all font-semibold text-gray-600">
              {item.icon} {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 shrink-0 border-t border-gray-100 bg-white">
          <button onClick={() => auth.signOut()} className="w-full flex items-center justify-center gap-3 p-3 text-gray-500 font-bold hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 ml-64 overflow-y-auto min-h-screen">
        <Outlet />
      </main>
    </div>
  );
};

// --- 3. Main App ---
export default function App() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const adminRef = doc(db, "admins", user.email);
          const adminSnap = await getDoc(adminRef);

          if (adminSnap.exists()) {
            setAdmin(user);
          } else {
            await signOut(auth);
            setAdmin(null);
            alert("Access Denied: You are not a Super Admin.");
          }
        } catch (error) {
          console.error("Admin Check Failed:", error);
          setAdmin(null);
        }
      } else {
        setAdmin(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-red-600 animate-pulse">
        Verifying Access...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!admin ? <Login /> : <Navigate to="/" replace />} />

        <Route element={admin ? <DashboardLayout /> : <Navigate to="/login" replace />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/credentials" element={<Credentials />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/bookings/:salonSlug" element={<Bookings />} />
          <Route path="/subscriptions" element={<Payments />} />
          <Route path="/manage-salons" element={<ManageSalons />} />
          <Route path="/banners" element={<Banners />} />
          <Route path="/support-tickets" element={<SupportTickets />} />
          <Route path="/reported-reviews" element={<ReportedReviews />} />
          <Route path="/settlements" element={<Settlements />} />
          <Route path="/users" element={<UserPage />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/broadcast" element={<Broadcast />} />
          <Route path="/global-offers" element={<GlobalOffers />} />
        </Route>

        <Route path="*" element={<Navigate to={admin ? "/" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}