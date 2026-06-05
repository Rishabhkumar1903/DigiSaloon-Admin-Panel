import { useState, useEffect } from "react";
import { db } from "../firebase-config";
import { collection, getDocs, collectionGroup, query, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { 
  Search, User as UserIcon, Phone, Mail, Calendar, 
  MapPin, Clock, Cake, Loader2, History, X, CreditCard, Store, 
  MoreVertical, Ban, Trash2, CheckCircle, ShieldAlert
} from "lucide-react";

export default function Users() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal & Actions State
  const [selectedUser, setSelectedUser] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [actionMenuOpen, setActionMenuOpen] = useState(null); // To toggle menu per card

  // Stats for Modal
  const [userStats, setUserStats] = useState({ totalSpent: 0, totalBookings: 0 });

  // 1. Fetch Users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const userList = querySnapshot.docs.map(doc => {
        const d = doc.data();
        let dateObj = null;
        if (d.createdAt?.toDate) dateObj = d.createdAt.toDate();
        else if (d.timestamp?.toDate) dateObj = d.timestamp.toDate();
        else if (d.updatedAt?.toDate) dateObj = d.updatedAt.toDate();

        const displayDate = dateObj 
          ? dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
          : "N/A";

        const addressParts = [d.address, d.city, d.state, d.pincode].filter(Boolean);
        const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : "Location N/A";

        return {
          id: doc.id,
          name: d.name || d.userName || "Unknown User",
          email: d.email || "No Email",
          phone: d.mobile || d.phone || d.phoneNumber || "",
          image: d.image || d.photoURL || null,
          gender: d.gender || "N/A",
          dob: d.dob || "N/A",
          address: fullAddress,
          joinDate: displayDate,
          isBlocked: d.isBlocked || false // Check block status
        };
      });
      setUsers(userList);
      setFilteredUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  // 2. Search Logic
  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const results = users.filter(user => 
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      user.phone.includes(term) ||
      user.address.toLowerCase().includes(term)
    );
    setFilteredUsers(results);
  }, [searchTerm, users]);

  // 3. ACTIONS: Block/Unblock User
  const toggleBlockUser = async (user) => {
      if(!window.confirm(`Are you sure you want to ${user.isBlocked ? 'unblock' : 'block'} ${user.name}?`)) return;
      try {
          await updateDoc(doc(db, "users", user.id), {
              isBlocked: !user.isBlocked
          });
          // Update Local State
          const updatedList = users.map(u => u.id === user.id ? { ...u, isBlocked: !u.isBlocked } : u);
          setUsers(updatedList);
          setActionMenuOpen(null);
      } catch (error) {
          alert("Error updating user status");
      }
  };

  // 4. ACTIONS: Delete User
  const handleDeleteUser = async (userId) => {
      if(!window.confirm("This will permanently delete the user. Are you sure?")) return;
      try {
          await deleteDoc(doc(db, "users", userId));
          // Remove from Local State
          const updatedList = users.filter(u => u.id !== userId);
          setUsers(updatedList);
          setFilteredUsers(updatedList);
          setActionMenuOpen(null);
      } catch (error) {
          alert("Error deleting user");
      }
  };

  // 5. VIEW HISTORY & CALCULATE STATS
  const handleViewHistory = async (user) => {
    setSelectedUser(user);
    setHistoryLoading(true);
    setUserBookings([]);
    setHistorySearchTerm("");
    setActionMenuOpen(null);

    try {
        const bookingsQuery = query(collectionGroup(db, "bookings")); 
        const querySnapshot = await getDocs(bookingsQuery);
        
        const history = [];
        let totalSpent = 0;
        let bookingCount = 0;
        
        querySnapshot.docs.forEach(doc => {
            const d = doc.data();
            const bookingPhone = d.phone || d.userPhone || "";
            const bookingUserId = d.userId || d.user_id;

            if ((user.phone && bookingPhone.includes(user.phone)) || (bookingUserId === user.id)) {
                
                let serviceName = "Service";
                if (d.services?.[0]) serviceName = d.services[0].name || d.services[0].serviceName;
                else if (d.service) serviceName = d.service;
                
                let amount = Number(d.totalAmount || d.price || 0);
                
                // Sorting Date
                let sortDate = new Date(0); 
                let displayDate = "N/A";

                if (d.timestamp?.toDate) {
                    sortDate = d.timestamp.toDate();
                    displayDate = sortDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                } else if (d.date && typeof d.date === 'string') {
                    sortDate = new Date(d.date);
                    displayDate = !isNaN(sortDate) ? sortDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : d.date;
                }

                // Stats Calculation (Only for completed/paid)
                if(d.status === 'completed' || d.paymentMethod === 'Online') {
                    totalSpent += amount;
                }
                bookingCount++;

                history.push({
                    id: doc.id,
                    salonName: d.salonName || "Unknown Salon",
                    service: serviceName,
                    amount: amount,
                    status: d.status || "pending",
                    displayDate: displayDate,
                    sortDate: sortDate,
                    paymentMethod: d.paymentMethod || "Cash",
                });
            }
        });

        history.sort((a, b) => b.sortDate - a.sortDate);
        setUserBookings(history);
        setUserStats({ totalSpent, totalBookings: bookingCount });

    } catch (error) { console.error(error); }
    setHistoryLoading(false);
  };

  const filteredHistory = userBookings.filter(booking => 
      booking.salonName.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      booking.service.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      booking.status.toLowerCase().includes(historySearchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    const s = status?.toLowerCase() || "";
    if(s === 'completed') return 'text-green-600 bg-green-50 border-green-100';
    if(s === 'cancelled') return 'text-red-600 bg-red-50 border-red-100';
    return 'text-blue-600 bg-blue-50 border-blue-100';
  };

  if (loading) return <div className="flex justify-center h-screen items-center"><Loader2 className="animate-spin text-blue-600" size={40}/></div>;

  return (
    <div className="p-8 bg-gray-50/50 min-h-screen relative" onClick={() => setActionMenuOpen(null)}>
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">User Management 👥</h1>
            <p className="text-sm text-gray-500 mt-1">Total {users.length} registered customers.</p>
        </div>
        <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-3.5 text-gray-400" size={20}/>
            <input type="text" placeholder="Search Name, Phone, Email..." className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none shadow-sm transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* USERS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                <UserIcon size={40} className="mx-auto text-gray-300 mb-2"/>
                <p className="text-gray-500 font-medium">No users found.</p>
            </div>
        ) : (
            filteredUsers.map((user) => (
                <div key={user.id} className={`bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all group relative ${user.isBlocked ? 'border-red-200 bg-red-50/50' : 'border-gray-100'}`}>
                    
                    {/* 🔥 3-DOT MENU */}
                    <div className="absolute top-4 right-4 z-10">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setActionMenuOpen(actionMenuOpen === user.id ? null : user.id); }} 
                            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <MoreVertical size={18}/>
                        </button>
                        
                        {actionMenuOpen === user.id && (
                            <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                                <button onClick={() => toggleBlockUser(user)} className={`w-full text-left px-4 py-3 text-xs font-bold flex items-center gap-2 hover:bg-gray-50 ${user.isBlocked ? 'text-green-600' : 'text-orange-600'}`}>
                                    {user.isBlocked ? <CheckCircle size={14}/> : <Ban size={14}/>} {user.isBlocked ? "Unblock User" : "Block User"}
                                </button>
                                <button onClick={() => handleDeleteUser(user.id)} className="w-full text-left px-4 py-3 text-xs font-bold text-red-600 flex items-center gap-2 hover:bg-red-50 border-t border-gray-50">
                                    <Trash2 size={14}/> Delete User
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-start gap-4 mb-4">
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 border overflow-hidden font-bold text-xl ${user.isBlocked ? 'bg-red-100 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                            {user.image ? <img src={user.image} alt={user.name} className="h-full w-full object-cover"/> : user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 pr-6">
                            <h3 className="font-bold text-gray-900 truncate text-lg">{user.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded uppercase">{user.gender}</span>
                                {user.dob !== "N/A" && <span className="text-[10px] flex items-center gap-1 text-gray-400"><Cake size={10}/> {user.dob}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 text-sm text-gray-600"><Mail size={14} className="text-gray-400"/> <span className="truncate font-medium">{user.email}</span></div>
                        <div className="flex items-center gap-2 text-sm text-gray-600"><Phone size={14} className="text-gray-400"/> <span className="font-medium">{user.phone}</span></div>
                        <div className="flex items-start gap-2 text-sm text-gray-600"><MapPin size={14} className="text-gray-400 mt-0.5 shrink-0"/> <span className="text-xs leading-tight">{user.address}</span></div>
                    </div>

                    <button onClick={() => handleViewHistory(user)} className="w-full py-2.5 bg-black text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all mb-3">
                        <History size={16}/> View Booking History
                    </button>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400"><Clock size={12}/> {user.joinDate === "N/A" ? "Recently Updated" : `Since ${user.joinDate}`}</div>
                        {user.isBlocked ? (
                            <span className="text-[10px] font-bold px-2 py-1 bg-red-100 text-red-700 rounded-md uppercase flex items-center gap-1"><ShieldAlert size={10}/> BLOCKED</span>
                        ) : (
                            <span className="text-[10px] font-bold px-2 py-1 bg-green-50 text-green-700 rounded-md uppercase">ACTIVE</span>
                        )}
                    </div>
                </div>
            ))
        )}
      </div>

      {/* HISTORY MODAL */}
      {selectedUser && (
          <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedUser(null)}></div>
              <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                  
                  <div className="p-6 border-b border-gray-100 bg-gray-50">
                      <div className="flex justify-between items-center mb-4">
                          <div><h2 className="text-xl font-bold text-gray-900">Booking History</h2><p className="text-sm text-gray-500">for {selectedUser.name}</p></div>
                          <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200 shadow-sm"><X size={20} className="text-gray-500"/></button>
                      </div>
                      
                      {/* 🔥 NEW: VIP STATS SUMMARY */}
                      <div className="flex gap-3 mb-4">
                          <div className="flex-1 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                              <p className="text-[10px] font-bold text-gray-400 uppercase">Total Spent</p>
                              <p className="text-lg font-black text-green-600">₹{userStats.totalSpent.toLocaleString()}</p>
                          </div>
                          <div className="flex-1 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                              <p className="text-[10px] font-bold text-gray-400 uppercase">Bookings</p>
                              <p className="text-lg font-black text-blue-600">{userStats.totalBookings}</p>
                          </div>
                      </div>

                      <div className="relative">
                          <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                          <input type="text" placeholder="Search history..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/50 outline-none" value={historySearchTerm} onChange={(e) => setHistorySearchTerm(e.target.value)} />
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {historyLoading ? (
                          <div className="text-center py-20"><Loader2 className="animate-spin text-blue-600 mx-auto mb-2" size={30}/><p className="text-sm text-gray-500">Fetching records...</p></div>
                      ) : filteredHistory.length === 0 ? (
                          <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200"><History className="mx-auto text-gray-300 mb-2" size={40}/><p className="text-gray-500 font-medium">No records found.</p></div>
                      ) : (
                          filteredHistory.map((booking) => (
                              <div key={booking.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                  <div className={`absolute top-0 left-0 w-1 h-full ${booking.status.toLowerCase() === 'completed' ? 'bg-green-500' : booking.status.toLowerCase() === 'cancelled' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                  <div className="pl-3">
                                      <div className="flex justify-between items-start mb-2">
                                          <div>
                                              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2"><Store size={14} className="text-gray-400"/> {booking.salonName}</h4>
                                              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Calendar size={10}/> {booking.displayDate}</p>
                                          </div>
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${getStatusColor(booking.status)}`}>{booking.status}</span>
                                      </div>
                                      <div className="bg-gray-50 p-2.5 rounded-lg mb-3"><p className="text-xs font-bold text-gray-700">{booking.service}</p></div>
                                      <div className="flex justify-between items-center text-sm">
                                          <div className="flex items-center gap-1.5 text-gray-500"><CreditCard size={14}/> <span className="text-xs">{booking.paymentMethod}</span></div>
                                          <span className="font-black text-gray-900">₹{booking.amount}</span>
                                      </div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}