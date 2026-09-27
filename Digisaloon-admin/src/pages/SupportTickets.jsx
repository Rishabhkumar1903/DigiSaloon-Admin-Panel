import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";

import { db } from "../firebase-config"; // Apna firebase config path check kar lena

import {
  Ticket,
  Search,
  ChevronDown,
  Eye,
  CheckCircle2,
  Clock3,
  AlertCircle,
  CircleDot,
  X,
  User,
  Phone,
  CalendarDays,
  Building2,
  ArrowRight,
  MessageSquareText,
  UserRoundCheck,
  RefreshCw,
  Loader2,
} from "lucide-react";

const SupportTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedTicket, setSelectedTicket] = useState(null);
  
  // Booking Details fetch karne ke liye states
  const [bookingDetails, setBookingDetails] = useState(null);
  const [fetchingBooking, setFetchingBooking] = useState(false);

  // Admin Notes ke liye naye states
  const [adminNote, setAdminNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [updating, setUpdating] = useState(false);

  // --------------------------------------------------
  // FIRESTORE: TICKETS FETCH
  // --------------------------------------------------

  useEffect(() => {
    const q = query(
      collection(db, "support_tickets"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ticketData = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setTickets(ticketData);
        setLoading(false);
      },
      (error) => {
        console.error("Support tickets listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // --------------------------------------------------
  // FIRESTORE: FETCH SELECTED BOOKING DETAILS & PRE-FILL NOTES
  // --------------------------------------------------
  useEffect(() => {
    // Naya ticket khulte hi text area ko clear kar do
    setAdminNote("");

    const fetchBookingDetails = async () => {
      if (selectedTicket && selectedTicket.bookingId && selectedTicket.salonId) {
        setFetchingBooking(true);
        try {
          const bookingRef = doc(
            db, 
            "partners", 
            selectedTicket.salonId, 
            "bookings", 
            selectedTicket.bookingId
          );
          
          const bookingSnap = await getDoc(bookingRef);
          
          if (bookingSnap.exists()) {
            setBookingDetails(bookingSnap.data());
          } else {
            setBookingDetails(null);
          }
        } catch (error) {
          console.error("Error fetching booking details:", error);
          setBookingDetails(null);
        } finally {
          setFetchingBooking(false);
        }
      } else {
        setBookingDetails(null);
      }
    };

    fetchBookingDetails();
  }, [selectedTicket]);

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------

  const getDate = (timestamp) => {
    if (!timestamp) return null;
    try {
      if (typeof timestamp.toDate === "function") return timestamp.toDate();
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return null;
      return date;
    } catch (error) {
      return null;
    }
  };

  const formatDate = (timestamp) => {
    const date = getDate(timestamp);
    if (!date) return "—";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (timestamp) => {
    const date = getDate(timestamp);
    if (!date) return "—";
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateTime = (timestamp) => {
    const date = getDate(timestamp);
    if (!date) return "—";
    return `${date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}, ${date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "Open": return "bg-orange-50 text-orange-700 border border-orange-100";
      case "In Progress": return "bg-blue-50 text-blue-700 border border-blue-100";
      case "Resolved": return "bg-green-50 text-green-700 border border-green-100";
      default: return "bg-slate-50 text-slate-600 border border-slate-200";
    }
  };

  // --------------------------------------------------
  // FILTERING
  // --------------------------------------------------

  const filteredTickets = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSearch =
        !search ||
        String(ticket.userName || "").toLowerCase().includes(search) ||
        String(ticket.userPhone || "").toLowerCase().includes(search) ||
        String(ticket.bookingId || "").toLowerCase().includes(search) ||
        String(ticket.salonName || "").toLowerCase().includes(search) ||
        String(ticket.issue || "").toLowerCase().includes(search) ||
        String(ticket.id || "").toLowerCase().includes(search);

      const matchesStatus = statusFilter === "All" || ticket.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tickets, searchTerm, statusFilter]);

  // --------------------------------------------------
  // COUNTS
  // --------------------------------------------------

  const totalTickets = tickets.length;
  const openTickets = tickets.filter((ticket) => ticket.status === "Open").length;
  const inProgressTickets = tickets.filter((ticket) => ticket.status === "In Progress").length;
  const resolvedTickets = tickets.filter((ticket) => ticket.status === "Resolved").length;
  const urgentTickets = tickets.filter((ticket) => ticket.priority === "Urgent").length;

  // --------------------------------------------------
  // UPDATE STATUS & NOTES
  // --------------------------------------------------

  const handleStatusUpdate = async (ticketId, newStatus) => {
    try {
      setUpdating(true);
      const ticketRef = doc(db, "support_tickets", ticketId);
      await updateDoc(ticketRef, {
        status: newStatus,
        lastUpdatedAt: new Date(),
      });
      setSelectedTicket((prev) => prev ? { ...prev, status: newStatus } : prev);
    } catch (error) {
      console.error("Error updating ticket status:", error);
    } finally {
      setUpdating(false);
    }
  };

  // Admin Note save karne ka function
  const handleAddNote = async () => {
    if (!selectedTicket || !adminNote.trim()) return;
    
    try {
      setSavingNote(true);
      const ticketRef = doc(db, "support_tickets", selectedTicket.id);
      
      await updateDoc(ticketRef, {
        adminNote: adminNote.trim(),
        lastUpdatedAt: new Date(),
      });
      
      // Update local state so changes reflect immediately in the UI
      setSelectedTicket((prev) => ({ ...prev, adminNote: adminNote.trim() }));
      setAdminNote(""); // Clear input box
    } catch (error) {
      console.error("Error saving note:", error);
      alert("Failed to add note. Try again.");
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] p-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
          <div className="mt-6 h-28 animate-pulse rounded-2xl bg-white" />
          <div className="mt-5 h-[500px] animate-pulse rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#f7f8fa] p-6">
        <div className="mx-auto max-w-[1600px]">

          {/* HEADER */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                <Ticket className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Support Tickets</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Manage and resolve user support issues and booking problems.
                </p>
              </div>
            </div>
          </div>

          {/* STATS */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard icon={<Ticket className="h-5 w-5" />} iconBg="bg-slate-100" iconColor="text-slate-600" title="Total Tickets" value={totalTickets} subtitle="All tickets" />
            <StatCard icon={<CircleDot className="h-5 w-5" />} iconBg="bg-red-50" iconColor="text-red-600" title="Open" value={openTickets} subtitle="Awaiting response" />
            <StatCard icon={<Clock3 className="h-5 w-5" />} iconBg="bg-orange-50" iconColor="text-orange-600" title="In Progress" value={inProgressTickets} subtitle="Being handled" />
            <StatCard icon={<CheckCircle2 className="h-5 w-5" />} iconBg="bg-green-50" iconColor="text-green-600" title="Resolved" value={resolvedTickets} subtitle="Completed tickets" />
            <StatCard icon={<AlertCircle className="h-5 w-5" />} iconBg="bg-red-50" iconColor="text-red-600" title="Urgent" value={urgentTickets} subtitle="Needs attention" />
          </div>

          {/* FILTER BAR */}
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search user, phone, booking ID, salon or issue..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100" />
              </div>
              <FilterSelect value={statusFilter} onChange={setStatusFilter} options={["All", "Open", "In Progress", "Resolved"]} />
              {(searchTerm || statusFilter !== "All") && (
                <button onClick={() => { setSearchTerm(""); setStatusFilter("All"); }} className="h-11 rounded-xl px-4 text-sm font-medium text-red-600 transition hover:bg-red-50">
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">User</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Booking</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Salon</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Issue</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Last Update</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="transition hover:bg-slate-50">
                      
                      {/* User */}
                      <td className="max-w-[180px] px-4 py-4">
                        <p className="truncate text-sm font-semibold text-slate-800" title={ticket.userName}>{ticket.userName || "Unknown User"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{ticket.userPhone || "—"}</p>
                      </td>

                      {/* Booking */}
                      <td className="max-w-[180px] px-4 py-4">
                        <p className="truncate text-sm font-semibold text-slate-800">#{ticket.bookingId || "—"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{ticket.serviceName || "Booking"}</p>
                      </td>

                      {/* Salon */}
                      <td className="max-w-[180px] px-4 py-4">
                        <p className="truncate text-sm font-semibold text-slate-800" title={ticket.salonName}>{ticket.salonName || "—"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{ticket.salonCity || ticket.city || "Ranchi"}</p>
                      </td>

                      {/* Issue */}
                      <td className="max-w-[250px] px-4 py-4">
                        <p className="truncate text-sm font-medium text-slate-700" title={ticket.issue}>{ticket.issue || "No issue description"}</p>
                        <p className="mt-0.5 text-xs text-slate-400">Click View for full details</p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyle(ticket.status)}`}>{ticket.status || "Open"}</span>
                      </td>

                      {/* Last Update */}
                      <td className="whitespace-nowrap px-4 py-4">
                        <p className="text-xs text-slate-500">{formatDate(ticket.lastUpdatedAt || ticket.updatedAt || ticket.createdAt)}</p>
                        <p className="text-xs text-slate-400">{formatTime(ticket.lastUpdatedAt || ticket.updatedAt || ticket.createdAt)}</p>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedTicket(ticket)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100">
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredTickets.length === 0 && (
              <div className="px-6 py-20 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                  <Ticket className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="text-sm font-semibold text-slate-700">No tickets found</h3>
                <p className="mt-1 text-sm text-slate-400">Try changing your search or filters.</p>
              </div>
            )}
            {filteredTickets.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
                <p className="text-sm text-slate-500">Showing <span className="font-semibold text-slate-700">{filteredTickets.length}</span> of <span className="font-semibold text-slate-700">{tickets.length}</span> tickets</p>
                <div className="text-xs text-slate-400">Realtime updates enabled</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================
          RIGHT DETAIL DRAWER
      ========================================= */}

      {selectedTicket && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px]" onClick={() => setSelectedTicket(null)} />
          <div className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[480px] flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-medium text-slate-400">Support Ticket</p>
                <h2 className="mt-1 text-lg font-bold text-slate-800">#{selectedTicket.bookingId || selectedTicket.id}</h2>
                <p className="mt-1 text-xs text-slate-400">Created on {formatDateTime(selectedTicket.createdAt)}</p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* DRAWER TOP BAR - Status Badge Only */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusStyle(selectedTicket.status)}`}>
                  {selectedTicket.status || "Open"}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* USER DETAILS */}
              <DetailSection icon={<User className="h-4 w-4" />} title="User Details">
                <InfoRow label="Name" value={selectedTicket.userName} />
                <InfoRow label="Phone" value={selectedTicket.userPhone} />
                <InfoRow label="User ID" value={selectedTicket.userId} />
              </DetailSection>

              {/* BOOKING DETAILS */}
              <DetailSection icon={<CalendarDays className="h-4 w-4" />} title="Booking Details">
                <InfoRow label="Booking ID" value={selectedTicket.bookingId ? `#${selectedTicket.bookingId}` : "—"} />
                <InfoRow label="Service" value={fetchingBooking ? "Loading..." : (bookingDetails?.services?.[0]?.name || bookingDetails?.serviceName || selectedTicket.serviceName || "—")} />
                <InfoRow label="Booking Date" value={fetchingBooking ? "Loading..." : (bookingDetails?.date || (bookingDetails?.bookingDate ? formatDate(bookingDetails.bookingDate) : formatDate(selectedTicket.bookingDate)) || "—")} />
                <InfoRow label="Booking Time" value={fetchingBooking ? "Loading..." : (bookingDetails?.time || bookingDetails?.bookingTime || selectedTicket.bookingTime || "—")} />
                <InfoRow label="Amount Paid" value={fetchingBooking ? "Loading..." : (bookingDetails?.advancePaid != null ? `₹${bookingDetails.advancePaid}` : selectedTicket.advancePaid != null ? `₹${selectedTicket.advancePaid}` : "—")} />
                <InfoRow label="Booking Status" value={fetchingBooking ? "Loading..." : (bookingDetails?.status || selectedTicket.status || "—")} />
              </DetailSection>

              {/* SALON DETAILS */}
              <DetailSection icon={<Building2 className="h-4 w-4" />} title="Salon Details">
                <InfoRow label="Salon Name" value={selectedTicket.salonName} />
                <InfoRow label="Salon ID" value={selectedTicket.salonId} />
                <InfoRow label="Location" value={selectedTicket.salonCity || selectedTicket.city || "Ranchi"} />
              </DetailSection>

              {/* ISSUE DETAILS */}
              <DetailSection icon={<AlertCircle className="h-4 w-4" />} title="Issue Details">
                <InfoRow label="Issue" value={selectedTicket.issue} />
                {selectedTicket.description && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium text-slate-400">Description</p>
                    <div className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{selectedTicket.description}</div>
                  </div>
                )}
              </DetailSection>

              {/* TIMELINE */}
              <DetailSection icon={<RefreshCw className="h-4 w-4" />} title="Timeline / Activity">
                <TimelineItem title="Ticket created by user" time={formatDateTime(selectedTicket.createdAt)} icon={<User className="h-3.5 w-3.5" />} />
                {selectedTicket.status === "In Progress" && <TimelineItem title="Ticket moved to In Progress" time={formatDateTime(selectedTicket.lastUpdatedAt)} icon={<Clock3 className="h-3.5 w-3.5" />} />}
                {selectedTicket.status === "Resolved" && <TimelineItem title="Ticket resolved" time={formatDateTime(selectedTicket.lastUpdatedAt)} icon={<CheckCircle2 className="h-3.5 w-3.5" />} />}
              </DetailSection>

              {/* ADMIN NOTES */}
              <DetailSection 
                icon={<MessageSquareText className="h-4 w-4" />} 
                title="Admin Notes" 
                action={
                  <button 
                    onClick={handleAddNote}
                    disabled={savingNote || !adminNote.trim()}
                    className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                  >
                    {savingNote ? "Saving..." : "Add Note"}
                  </button>
                }
              >
                <textarea 
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Type a new internal note here..." 
                  className="h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-red-300 focus:bg-white transition" 
                />

                {/* Yahan saved note show hoga */}
                {selectedTicket.adminNote && (
                  <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                    <p className="mb-2 text-[10px] font-bold text-yellow-800 uppercase tracking-wider flex items-center gap-1">
                      <MessageSquareText size={12}/> Saved Note
                    </p>
                    <p className="text-sm text-yellow-900 whitespace-pre-wrap leading-relaxed">{selectedTicket.adminNote}</p>
                  </div>
                )}
              </DetailSection>
            </div>

            {/* BOTTOM ACTIONS */}
            <div className="border-t border-slate-200 bg-white p-4">
              <div className="flex gap-2">
                <button className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"><UserRoundCheck className="mr-2 inline h-4 w-4" /> Assign</button>
                {selectedTicket.status !== "In Progress" && selectedTicket.status !== "Resolved" && (
                  <button onClick={() => handleStatusUpdate(selectedTicket.id, "In Progress")} disabled={updating} className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 transition">
                    {updating ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Clock3 className="mr-2 inline h-4 w-4" />} Mark In Progress
                  </button>
                )}
                {selectedTicket.status !== "Resolved" && (
                  <button onClick={() => handleStatusUpdate(selectedTicket.id, "Resolved")} disabled={updating} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
                    {updating ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 inline h-4 w-4" />} Resolve Ticket
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

// =====================================================
// HELPER COMPONENTS
// =====================================================

const StatCard = ({ icon, iconBg, iconColor, title, value, subtitle }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>{icon}</div>
    </div>
    <p className="mt-4 text-xs font-medium text-slate-400">{title}</p>
    <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
  </div>
);

const FilterSelect = ({ value, onChange, options }) => (
  <div className="relative">
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 min-w-[150px] appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm text-slate-700 outline-none focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100">
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
  </div>
);

const DetailSection = ({ icon, title, action, children }) => (
  <div className="border-b border-slate-100 px-6 py-5">
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2"><div className="text-red-600">{icon}</div><h3 className="text-sm font-bold text-slate-800">{title}</h3></div>
      {action}
    </div>
    {children}
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="mb-3 grid grid-cols-[110px_1fr] gap-3 last:mb-0">
    <span className="text-xs font-medium text-slate-400 shrink-0">
      {label}
    </span>
    
    {/* min-w-0 lagane se grid column stretch nahi hoga aur break-all se lamba bina space ka text next line me shift ho jayega */}
    <div className="min-w-0">
      <p className="break-all text-sm font-medium text-slate-700">
        {value || "—"}
      </p>
    </div>
  </div>
);

const TimelineItem = ({ title, time, icon }) => (
  <div className="relative flex gap-3 pb-5 last:pb-0">
    <div className="relative flex flex-col items-center">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-600">{icon}</div>
      <div className="mt-1 h-full w-px bg-slate-200 last:hidden" />
    </div>
    <div className="pt-1">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{time}</p>
    </div>
  </div>
);

export default SupportTickets;