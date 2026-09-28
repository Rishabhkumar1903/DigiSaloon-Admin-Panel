import { useState, useEffect } from "react";
// 🔥 IMPORTANT: firebaseConfig ko import kiya gaya hai secondary app ke liye 🔥
import { db, storage, auth, firebaseConfig } from "../firebase-config";
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

import {
    Store, MapPin, Phone, Search, Plus, Edit3, Trash2,
    Save, X, Loader2, List, Banknote, Copy, Clock, Layers,
    Briefcase, ShieldCheck, User, Scissors, Gift, Star, Users,
    Landmark, FileText, UploadCloud // 🔥 NAYA
} from "lucide-react";
import imageCompression from 'browser-image-compression';

export default function ManageSalons() {
    const [loading, setLoading] = useState(true);
    const [partners, setPartners] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

    // --- STATES FOR EDITING ---
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [activeTab, setActiveTab] = useState("details");
    const [isSaving, setIsSaving] = useState(false);
    const [editFormData, setEditFormData] = useState(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // --- STATES FOR SERVICES ---
    const [serviceList, setServiceList] = useState([]);
    const [isFetchingServices, setIsFetchingServices] = useState(false);
    // 🔥 UPDATE: subtext add kiya initial state mein
    const [newService, setNewService] = useState({ name: "", subtext: "", price: "", time: "30", targetGender: "Unisex", category: "Hair" });
    const [imageFile, setImageFile] = useState(null);
    const [hasVariants, setHasVariants] = useState(false);
    const [variantList, setVariantList] = useState([{ name: "", price: "", time: "30" }]);

    // --- STATES FOR STYLIST PHOTOS (Old Tab) ---
    const [newStylist, setNewStylist] = useState({ name: "", role: "" });
    const [stylistImageFile, setStylistImageFile] = useState(null);

    // --- STATES FOR TEAM MANAGEMENT (LOGIN ACCESS) ---
    const [newStaff, setNewStaff] = useState({ name: "", phone: "", password: "", role: "manager" });
    const [staffList, setStaffList] = useState([]);
    const [isFetchingStaff, setIsFetchingStaff] = useState(false);

    // --- STATES FOR OFFERS & ADS ---
    const [bannerBadge, setBannerBadge] = useState("");
    const [bannerText, setBannerText] = useState("");
    const [isSavingBanner, setIsSavingBanner] = useState(false);

    const [promoCodes, setPromoCodes] = useState([]);
    const [isFetchingPromo, setIsFetchingPromo] = useState(false);
    const [newPromo, setNewPromo] = useState({ code: "", type: "percentage", value: "", minOrder: "", maxDiscount: "" });
    const [isSavingPromo, setIsSavingPromo] = useState(false);

    const CATEGORIES = ["Hair", "Beard", "Facial", "Massage", "Manicure", "Pedicure", "Waxing", "Threading", "Hair Colour", "Bridal", "Skin Care", "Spa", "Other"];

    // --- STATES FOR ADDING SALON ---
    const [isAddingSalon, setIsAddingSalon] = useState(false);
    const [newSalonData, setNewSalonData] = useState({
        salonName: "", salonType: "Unisex", outletType: "Rent", branches: "0",
        ownerName: "", ownerPhone: "", ownerEmail: "",
        area: "", city: "Ranchi", pincode: "", mapsLink: "", latitude: "", longitude: "",
        openTime: "10:00 AM", closeTime: "08:00 PM", weeklyOff: "Mon",
        gstNumber: "", panNumber: "",
        upiId: "", accountNumber: "", bankName: "", ifscCode: "",
        salonImage: ""
    });

    // 🔥 HELPER: Dynamic GST Calculator based on Selected Partner 🔥
    const calculateGSTBreakdown = (priceValue) => {
        if (!selectedPartner) return null;
        const hasGST = String(selectedPartner.legal?.gstRegistered || "").trim().toLowerCase() === "yes";
        const gstRate = selectedPartner.legal?.gstRate ? Number(selectedPartner.legal.gstRate) : 18;

        const parsedPrice = parseFloat(priceValue) || 0;
        if (!hasGST || parsedPrice === 0) return null;
        const basePrice = parsedPrice / (1 + (gstRate / 100));
        const tax = parsedPrice - basePrice;
        return { base: basePrice.toFixed(2), tax: tax.toFixed(2), rate: gstRate };
    };

    const updateSalonMainProfile = async (salonId) => {
        try {
            const servicesSnapshot = await getDocs(collection(db, "partners", salonId, "services_menu"));
            const services = servicesSnapshot.docs.map(doc => doc.data());

            let startingPrice = 9999;
            let keywords = [];

            services.forEach(service => {
                const price = parseInt(String(service.price || '0').replace(/[^0-9]/g, ''), 10);
                if (price > 0 && price < startingPrice) startingPrice = price;

                if (service.name || service.title) {
                    keywords.push((service.name || service.title).toLowerCase());
                }
                if (service.category) {
                    keywords.push(service.category.toLowerCase());
                }
            });

            if (startingPrice === 9999) startingPrice = 150;
            const uniqueKeywords = [...new Set(keywords)];

            const partnerRef = doc(db, "partners", salonId);
            await updateDoc(partnerRef, { startingPrice: startingPrice, serviceKeywords: uniqueKeywords });

            const salonRef = doc(db, "salons", salonId);
            await updateDoc(salonRef, { startingPrice: startingPrice, serviceKeywords: uniqueKeywords });

        } catch (error) {
            console.error("Error updating salon main profile from Admin:", error);
        }
    };

    const fetchPartners = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "partners"));
            const list = querySnapshot.docs.map(doc => {
                const d = doc.data();
                const name = d.salonName || d.basicInfo?.salonName || "Unknown Salon";
                const phone = d.ownerInfo?.phone || d.phone || d.basicInfo?.ownerPhone || "N/A";

                let area = "Unknown Area";
                let city = "Ranchi";
                if (d.address) {
                    if (typeof d.address === 'object') {
                        area = d.address.area || "";
                        city = d.address.city || "Ranchi";
                    } else if (typeof d.address === 'string') area = d.address;
                }

                return {
                    id: doc.id,
                    ...d,
                    displayName: name,
                    displayPhone: phone,
                    displayArea: area,
                    displayCity: city,
                    rating: d.rating || 0,
                    ratingCount: d.ratingCount || 0
                };
            });
            setPartners(list);
        } catch (error) { console.error(error); }
        setLoading(false);
    };

    useEffect(() => { fetchPartners(); }, []);

    const fetchServices = async (partnerId) => {
        setIsFetchingServices(true);
        try {
            const querySnapshot = await getDocs(collection(db, "partners", partnerId, "services_menu"));
            const services = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setServiceList(services);
        } catch (error) { console.error(error); }
        setIsFetchingServices(false);
    };

    const fetchPromoCodes = (partnerId) => {
        setIsFetchingPromo(true);
        try {
            const q = collection(db, "partners", partnerId, "internal_offers");
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const codes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPromoCodes(codes);
                setIsFetchingPromo(false);
            });
            return unsubscribe;
        } catch (error) {
            console.error(error);
            setIsFetchingPromo(false);
        }
    };

    const fetchStaffAccounts = (partnerId) => {
        setIsFetchingStaff(true);
        try {
            const staffRef = collection(db, 'partners', partnerId, 'staff');
            const unsubscribe = onSnapshot(staffRef, (snapshot) => {
                const staffMembers = [];
                snapshot.forEach((doc) => {
                    staffMembers.push({ id: doc.id, ...doc.data() });
                });
                setStaffList(staffMembers);
                setIsFetchingStaff(false);
            });
            return unsubscribe;
        } catch (error) {
            console.error(error);
            setIsFetchingStaff(false);
        }
    };

    useEffect(() => {
        if (selectedPartner) {
            setEditFormData({
                salonName: selectedPartner.basicInfo?.salonName || selectedPartner.salonName || "",
                salonType: selectedPartner.basicInfo?.salonType || "Unisex",
                outletType: selectedPartner.basicInfo?.outletType || "Rent",
                ownerName: selectedPartner.ownerInfo?.name || "",
                ownerPhone: selectedPartner.ownerInfo?.phone || selectedPartner.phone || "",
                ownerEmail: selectedPartner.ownerInfo?.email || "",
                area: selectedPartner.address?.area || (typeof selectedPartner.address === 'string' ? selectedPartner.address : ""),
                city: selectedPartner.address?.city || "Ranchi",
                pincode: selectedPartner.address?.pincode || "",
                mapsLink: selectedPartner.address?.mapsLink || "",
                latitude: selectedPartner.basicInfo?.latitude || selectedPartner.lat || "",
                longitude: selectedPartner.basicInfo?.longitude || selectedPartner.lng || "",
                images: selectedPartner.images || [],
                team: selectedPartner.team || [],
                openTime: selectedPartner.operations?.openTime || "10:00 AM",
                closeTime: selectedPartner.operations?.closeTime || "08:00 PM",
                weeklyOff: selectedPartner.operations?.weeklyOff?.[0] || "Mon",
                // Existing fields ke sath inko replace/add karo:
            gstNumber: selectedPartner.legal?.gstNumber || "",
            panNumber: selectedPartner.legal?.panNumber || "",
            gstRate: selectedPartner.legal?.gstRate || "18",
            gstRegistered: selectedPartner.legal?.gstRegistered === "Yes",
            panUrl: selectedPartner.legal?.panUrl || "",
            upiId: selectedPartner.bankDetails?.upiId || "",
            accountNumber: selectedPartner.bankDetails?.accountNumber || "",
            accountName: selectedPartner.bankDetails?.accountName || "",
            bankName: selectedPartner.bankDetails?.bankName || "",
            ifscCode: selectedPartner.bankDetails?.ifscCode || "",
            passbookUrl: selectedPartner.bankDetails?.passbookUrl || ""
            });

            setBannerBadge(selectedPartner.offerBadge || "");
            setBannerText(selectedPartner.offerText || "");

            if (activeTab === 'menu') fetchServices(selectedPartner.id);
            if (activeTab === 'offers') fetchPromoCodes(selectedPartner.id);
            if (activeTab === 'staff') fetchStaffAccounts(selectedPartner.id);
        }
    }, [selectedPartner, activeTab]);

    const handleUpdateDetails = async () => {
        if (!selectedPartner || !editFormData) return;
        setIsSaving(true);
        try {
            const docRef = doc(db, "partners", selectedPartner.id);
            const updatedData = {
                "basicInfo.salonName": editFormData.salonName,
                "basicInfo.salonType": editFormData.salonType,
                "basicInfo.outletType": editFormData.outletType,
                "ownerInfo.name": editFormData.ownerName,
                "ownerInfo.phone": editFormData.ownerPhone,
                "ownerInfo.email": editFormData.ownerEmail,
                "address.area": editFormData.area,
                "address.city": editFormData.city,
                "address.pincode": editFormData.pincode,
                "address.mapsLink": editFormData.mapsLink,
                "basicInfo.latitude": parseFloat(editFormData.latitude) || 0,
                "basicInfo.longitude": parseFloat(editFormData.longitude) || 0,
                "lat": parseFloat(editFormData.latitude) || 0,
                "lng": parseFloat(editFormData.longitude) || 0,
                "operations.openTime": editFormData.openTime,
                "operations.closeTime": editFormData.closeTime,
                "operations.weeklyOff": [editFormData.weeklyOff],
                "legal.gstNumber": editFormData.gstNumber,
                "legal.panNumber": editFormData.panNumber,
                "legal.gstRegistered": editFormData.gstRegistered ? "Yes" : "No",
                "legal.gstRate": Number(editFormData.gstRate || 18),
                "legal.panUrl": editFormData.panUrl,
                "bankDetails.upiId": editFormData.upiId,
                "bankDetails.accountNumber": editFormData.accountNumber,
                "bankDetails.accountName": editFormData.accountName,
                "bankDetails.bankName": editFormData.bankName,
                "bankDetails.ifscCode": editFormData.ifscCode,
                "bankDetails.passbookUrl": editFormData.passbookUrl,
                salonName: editFormData.salonName,
                images: editFormData.images || []
            };

            await updateDoc(docRef, updatedData);
            alert("Updated Successfully! ✅");
            fetchPartners();
        } catch (e) { console.error(e); alert("Update Failed ❌"); }
        setIsSaving(false);
    };

    const handleUploadSalonImage = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploadingImage(true);
        try {
            const options = { maxSizeMB: 0.06, maxWidthOrHeight: 800, useWebWorker: true, fileType: 'image/webp', initialQuality: 0.75 };
            const compressedFile = await imageCompression(file, options);
            const imageRef = ref(storage, `salons/${selectedPartner.id}/gallery/${Date.now()}_gallery.webp`);
            const uploadResult = await uploadBytes(imageRef, compressedFile);
            const downloadUrl = await getDownloadURL(uploadResult.ref);

            setEditFormData(prev => ({ ...prev, images: [...(prev.images || []), downloadUrl] }));
            e.target.value = null;
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Failed to upload image.");
        }
        setIsUploadingImage(false);
    };

    const handleUploadBankDoc = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploadingImage(true);
        try {
            const options = { maxSizeMB: 0.1, maxWidthOrHeight: 1000, useWebWorker: true, fileType: 'image/webp' };
            const compressedFile = await imageCompression(file, options);
            const path = type === 'pan' ? `salons/${selectedPartner.id}/legal/pan_${Date.now()}.webp` : `salons/${selectedPartner.id}/bank/passbook_${Date.now()}.webp`;
            const docRef = ref(storage, path);
            const uploadResult = await uploadBytes(docRef, compressedFile);
            const downloadUrl = await getDownloadURL(uploadResult.ref);

            if (type === 'pan') setEditFormData(prev => ({ ...prev, panUrl: downloadUrl }));
            if (type === 'passbook') setEditFormData(prev => ({ ...prev, passbookUrl: downloadUrl }));
        } catch (error) {
            console.error("Error uploading document:", error);
            alert("Failed to upload document.");
        }
        setIsUploadingImage(false);
    };

    const handleVariantChange = (index, field, value) => {
        const updated = [...variantList]; updated[index][field] = value; setVariantList(updated);
    };
    const addVariantRow = () => setVariantList([...variantList, { name: "", price: "", time: "30" }]);
    const removeVariantRow = (index) => setVariantList(variantList.filter((_, i) => i !== index));

    const handleAddService = async () => {
        if (!newService.name) return alert("Enter Service Name");
        if (!newService.price || !newService.time) return alert("Enter Price and Time");
        
        setIsSaving(true);
        try {
            let finalImageUrl = "";
            if (imageFile) {
                const options = { maxSizeMB: 0.02, maxWidthOrHeight: 500, useWebWorker: true, fileType: 'image/webp', initialQuality: 0.7 };
                const compressedImage = await imageCompression(imageFile, options);
                const imageRef = ref(storage, `salons/${selectedPartner.id}/services/${Date.now()}_service.webp`);
                const uploadResult = await uploadBytes(imageRef, compressedImage);
                finalImageUrl = await getDownloadURL(uploadResult.ref);
            }

            const hasGST = String(selectedPartner.legal?.gstRegistered || "").trim().toLowerCase() === "yes";
            const gstRate = selectedPartner.legal?.gstRate ? Number(selectedPartner.legal.gstRate) : 18; 

            const mainParsedPrice = parseFloat(newService.price) || 0;
            const mainBasePrice = hasGST ? (mainParsedPrice / (1 + gstRate / 100)) : mainParsedPrice;
            const mainTaxAmount = hasGST ? (mainParsedPrice - mainBasePrice) : 0;

            const processedVariants = hasVariants ? variantList.map(v => {
                const vParsed = parseFloat(v.price) || 0;
                const vBase = hasGST ? (vParsed / (1 + gstRate / 100)) : vParsed;
                const vTax = hasGST ? (vParsed - vBase) : 0;
                return {
                    name: v.name,
                    price: v.price.toString(),
                    time: v.time.toString(),
                    basePrice: Number(vBase.toFixed(2)),
                    taxAmount: Number(vTax.toFixed(2))
                };
            }) : [];

            const newDocRef = doc(collection(db, `partners/${selectedPartner.id}/services_menu`));
            const actualDocId = newDocRef.id;

            const payload = {
                id: actualDocId,
                name: newService.name,
                subtext: newService.subtext || "", // 🔥 Subtext included
                targetGender: newService.targetGender, 
                category: newService.category,
                image: finalImageUrl,
                price: newService.price.toString() || "0",
                time: newService.time.toString(),
                
                basePrice: Number(mainBasePrice.toFixed(2)),
                taxAmount: Number(mainTaxAmount.toFixed(2)),
                gstRate: hasGST ? gstRate : 0,

                isCustomizable: hasVariants,
                enabled: true,
                createdAt: serverTimestamp(),
                variants: processedVariants
            };

            const batch = writeBatch(db);
            batch.set(doc(db, `partners/${selectedPartner.id}/services_menu`, actualDocId), payload);
            batch.set(doc(db, `salons/${selectedPartner.id}/services_menu`, actualDocId), payload);
            await batch.commit();

            await updateSalonMainProfile(selectedPartner.id);

            fetchServices(selectedPartner.id);
            setNewService({ name: "", subtext: "", price: "", time: "30", targetGender: "Unisex", category: "Hair" });
            setImageFile(null);
            setHasVariants(false);
            setVariantList([{ name: "", price: "", time: "30" }]);
            
            alert("Service Saved Successfully with GST! ✅");
        } catch (e) { 
            console.error(e);
            alert("Failed to add service: " + e.message); 
        }
        setIsSaving(false);
    };

    const handleDeleteService = async (serviceId) => {
        if (!window.confirm("Delete this service?")) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, `partners/${selectedPartner.id}/services_menu`, serviceId));
            batch.delete(doc(db, `salons/${selectedPartner.id}/services_menu`, serviceId));
            await batch.commit();
            
            await updateSalonMainProfile(selectedPartner.id);
            fetchServices(selectedPartner.id);
        }
        catch (e) { 
            console.error("Delete failed:", e);
            alert("Failed to delete"); 
        }
        setIsSaving(false);
    };

    const handleAddStaffAccount = async () => {
        if (!selectedPartner) return alert('System Error: Salon ID is missing!');

        const { name, phone, password, role } = newStaff;
        if (!name || !phone || !password) return alert('Please fill all fields');
        if (phone.length !== 10) return alert('Phone number must be exactly 10 digits.');

        const passwordRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])/;
        if (password.length < 6 || !passwordRegex.test(password)) {
            return alert('Password must be at least 6 characters long and contain BOTH letters and numbers (e.g., rahul123).');
        }

        setIsSaving(true);
        try {
            const appName = "AdminStaffCreatorApp";
            const secondaryApp = getApps().find(app => app.name === appName) 
                ? getApp(appName) 
                : initializeApp(firebaseConfig, appName);
            const secondaryAuth = getAuth(secondaryApp);

            const dummyEmail = `${phone}@staff.digisaloon.in`;

            await createUserWithEmailAndPassword(secondaryAuth, dummyEmail, password);
            await signOut(secondaryAuth);

            const newStaffRef = doc(db, 'partners', selectedPartner.id, 'staff', phone);
            await setDoc(newStaffRef, {
                name: name,
                phone: phone,
                authEmail: dummyEmail,
                password: password,
                role: role,
                salonId: selectedPartner.id,
                isActive: true,
                createdAt: serverTimestamp()
            });

            setNewStaff({ name: "", phone: "", password: "", role: "manager" });
            alert(`${name} added successfully as ${role}! 🎉`);
        } catch (error) {
            console.error("Error adding staff: ", error);
            if (error.code === 'auth/email-already-in-use') {
                alert("This phone number is already registered as a staff member.");
            } else {
                alert("Something went wrong while creating auth access!");
            }
        }
        setIsSaving(false);
    };

    const handleToggleStaffStatus = async (staffPhone, currentStatus, staffName) => {
        const confirmMessage = currentStatus ? `Are you sure you want to BLOCK ${staffName}?` : `Are you sure you want to UNBLOCK ${staffName}?`;
        if (window.confirm(confirmMessage)) {
            setIsSaving(true);
            try {
                const staffDocRef = doc(db, 'partners', selectedPartner.id, 'staff', staffPhone);
                await updateDoc(staffDocRef, { isActive: !currentStatus });
            } catch (error) {
                console.error("Error updating status: ", error);
                alert("Failed to change status.");
            }
            setIsSaving(false);
        }
    };

    const handleDeleteStaffAccount = async (staffPhone, staffName) => {
        if (window.confirm(`PERMANENT DELETE: Are you sure you want to permanently delete ${staffName}?`)) {
            setIsSaving(true);
            try {
                await deleteDoc(doc(db, 'partners', selectedPartner.id, 'staff', staffPhone));
            } catch (error) {
                console.error("Error deleting staff: ", error);
                alert("Failed to delete staff account.");
            }
            setIsSaving(false);
        }
    };

    const handleAddStylist = async () => {
        if (!newStylist.name || !newStylist.role) return alert("Stylist Name and Role are required!");
        setIsSaving(true);
        try {
            let finalImageUrl = "";
            if (stylistImageFile) {
                const options = { maxSizeMB: 0.1, maxWidthOrHeight: 500, useWebWorker: true, fileType: 'image/webp' };
                const compressedImage = await imageCompression(stylistImageFile, options);
                const imageRef = ref(storage, `salons/${selectedPartner.id}/stylists/${Date.now()}_stylist.webp`);
                const uploadResult = await uploadBytes(imageRef, compressedImage);
                finalImageUrl = await getDownloadURL(uploadResult.ref);
            }

            const newMember = { id: Date.now().toString(), name: newStylist.name, role: newStylist.role, image: finalImageUrl, addedAt: new Date().toISOString() };
            const updatedTeam = [...(editFormData.team || []), newMember];

            const docRef = doc(db, "partners", selectedPartner.id);
            await updateDoc(docRef, { team: updatedTeam });

            setEditFormData({ ...editFormData, team: updatedTeam });
            setSelectedPartner(prev => ({ ...prev, team: updatedTeam }));
            setPartners(prev => prev.map(p => p.id === selectedPartner.id ? { ...p, team: updatedTeam } : p));

            setNewStylist({ name: "", role: "" });
            setStylistImageFile(null);
            document.getElementById('stylist-file-input').value = '';
            alert("Stylist Added Successfully! 🎉");

        } catch (e) { console.error(e); alert("Failed to add stylist."); }
        setIsSaving(false);
    };

    const handleDeleteStylist = async (stylistId) => {
        if (!window.confirm("Remove this stylist from the team?")) return;
        setIsSaving(true);
        try {
            const updatedTeam = editFormData.team.filter(s => s.id !== stylistId);
            const docRef = doc(db, "partners", selectedPartner.id);
            await updateDoc(docRef, { team: updatedTeam });
            
            setEditFormData({ ...editFormData, team: updatedTeam });
            setSelectedPartner(prev => ({ ...prev, team: updatedTeam }));
            setPartners(prev => prev.map(p => p.id === selectedPartner.id ? { ...p, team: updatedTeam } : p));
            
        } catch (e) { console.error(e); alert("Failed to remove stylist."); }
        setIsSaving(false);
    };

    const handleSaveBanner = async () => {
        if (!selectedPartner) return;
        setIsSavingBanner(true);
        try {
            const docRef = doc(db, "partners", selectedPartner.id);
            await updateDoc(docRef, { offerBadge: bannerBadge.trim(), offerText: bannerText.trim() });
            alert("Banner updated successfully on User App! 🎉");
            selectedPartner.offerBadge = bannerBadge.trim();
            selectedPartner.offerText = bannerText.trim();
        } catch (error) { console.error(error); alert("Failed to update banner."); }
        setIsSavingBanner(false);
    };

    const handleAddPromoCode = async () => {
        if (!selectedPartner) return;
        if (!newPromo.code.trim() || !newPromo.value || !newPromo.minOrder) return alert("Code, Value, and Min Order are required.");
        setIsSavingPromo(true);
        try {
            const cleanCode = newPromo.code.trim().toUpperCase();
            const dataToSave = {
                discountType: newPromo.type, discountValue: Number(newPromo.value), minOrderValue: Number(newPromo.minOrder),
                maxDiscount: newPromo.type === 'percentage' && newPromo.maxDiscount ? Number(newPromo.maxDiscount) : null,
                isActive: true, salonId: selectedPartner.id, createdAt: serverTimestamp()
            };
            await setDoc(doc(db, "partners", selectedPartner.id, "internal_offers", cleanCode), dataToSave, { merge: true });
            alert("Promo code added successfully!");
            setNewPromo({ code: "", type: "percentage", value: "", minOrder: "", maxDiscount: "" });
        } catch (error) { console.error(error); alert("Failed to add promo code."); }
        setIsSavingPromo(false);
    };

    const handleDeletePromo = async (promoId) => {
        if (!window.confirm(`Are you sure you want to delete promo code: ${promoId}?`)) return;
        try { await deleteDoc(doc(db, "partners", selectedPartner.id, "internal_offers", promoId)); }
        catch (error) { console.error(error); alert("Failed to delete promo code."); }
    };

    const handleCreateSalon = async () => {
        if (!newSalonData.salonName || !newSalonData.ownerPhone || !newSalonData.ownerEmail) return alert("Salon Name, Phone, and Email are required!");
        setIsSaving(true);
        try {
            const newDoc = {
                basicInfo: { salonName: newSalonData.salonName, salonType: newSalonData.salonType, outletType: newSalonData.outletType, branches: newSalonData.branches, latitude: parseFloat(newSalonData.latitude) || 0, longitude: parseFloat(newSalonData.longitude) || 0 },
                ownerInfo: { name: newSalonData.ownerName, phone: newSalonData.ownerPhone, email: newSalonData.ownerEmail, partnerId: Date.now().toString() },
                address: { area: newSalonData.area, city: newSalonData.city, pincode: newSalonData.pincode, mapsLink: newSalonData.mapsLink },
                lat: parseFloat(newSalonData.latitude) || 0, lng: parseFloat(newSalonData.longitude) || 0,
                operations: { openTime: newSalonData.openTime, closeTime: newSalonData.closeTime, weeklyOff: [newSalonData.weeklyOff], facilities: ["AC", "WiFi"] },
                legal: { gstRegistered: newSalonData.gstNumber ? "Yes" : "No", gstNumber: newSalonData.gstNumber, panNumber: newSalonData.panNumber },
                bankDetails: { upiId: newSalonData.upiId, accountNumber: newSalonData.accountNumber, ifscCode: newSalonData.ifscCode, bankName: newSalonData.bankName },
                images: newSalonData.salonImage ? [newSalonData.salonImage] : [],
                salonName: newSalonData.salonName, isActive: true, isLive: false, isShopOpen: false, verifiedByAdmin: false, status: "pending", isBlocked: false, walletBalance: 0, createdAt: new Date(), team: []
            };

            await addDoc(collection(db, "partners"), newDoc);
            alert("Salon Created & Set to Pending Verification! ⏳");
            setIsAddingSalon(false);
            fetchPartners();
            setNewSalonData({ salonName: "", salonType: "Unisex", outletType: "Rent", branches: "0", ownerName: "", ownerPhone: "", ownerEmail: "", area: "", city: "Ranchi", pincode: "", mapsLink: "", latitude: "", longitude: "", openTime: "10:00 AM", closeTime: "08:00 PM", weeklyOff: "Mon", gstNumber: "", panNumber: "", upiId: "", accountNumber: "", bankName: "", ifscCode: "", salonImage: "" });
        } catch (e) { console.error(e); alert("Creation Failed"); }
        setIsSaving(false);
    };

    const filteredPartners = partners.filter(p =>
        p.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.displayArea?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 bg-gray-50/50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Salon Directory 🏪</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage active salons, menus & bank details.</p>
                </div>
                <button onClick={() => setIsAddingSalon(true)} className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all">
                    <Plus size={18} /> Add Salon Manually
                </button>
            </div>

            <div className="max-w-7xl mx-auto mb-6 relative">
                <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input type="text" placeholder="Search Salon..." className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                    {filteredPartners.map(partner => (
                        <div key={partner.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                            <div className="p-5 flex flex-col h-full">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 font-bold text-xl uppercase shrink-0">{partner.displayName?.[0] || "S"}</div>
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase shrink-0 ${partner.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{partner.isActive !== false ? 'Active' : 'Inactive'}</span>
                                </div>

                                <h3 className="font-bold text-lg text-gray-900 mb-1 line-clamp-3 break-all" title={partner.displayName}>{partner.displayName}</h3>

                                <div className="flex items-center gap-1.5 mb-2">
                                    <div className="flex items-center text-yellow-500 bg-yellow-50 px-1.5 py-0.5 rounded text-xs font-bold border border-yellow-100">
                                        <Star size={12} className="fill-yellow-500 mr-1" />
                                        {Number(partner.rating || 0).toFixed(1)}
                                    </div>
                                    <span className="text-xs font-medium text-gray-400">
                                        ({partner.ratingCount || 0} Reviews)
                                    </span>
                                </div>

                                <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-1 truncate w-full" title={`${partner.displayArea}, ${partner.displayCity}`}>
                                    <MapPin size={14} className="shrink-0" /> <span className="truncate">{partner.displayArea}, {partner.displayCity}</span>
                                </p>
                                <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-4 truncate w-full" title={partner.displayPhone}>
                                    <Phone size={14} className="shrink-0" /> <span className="truncate">{partner.displayPhone}</span>
                                </p>
                                <div className="flex gap-2 border-t border-gray-100 pt-4 mt-auto flex-wrap">
                                    <button onClick={() => { setSelectedPartner(partner); setActiveTab('details'); }} className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><Edit3 size={16} /> Edit</button>
                                    <button onClick={() => { setSelectedPartner(partner); setActiveTab('menu'); }} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><List size={16} /> Menu</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isAddingSalon && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-gray-800">Add New Salon</h2>
                            <button onClick={() => setIsAddingSalon(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} className="text-gray-500" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-5 rounded-xl border border-gray-200">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Store size={18} className="text-blue-500" /> Basic Info</h3>
                                    <div className="space-y-3">
                                        <div><label className="text-xs font-bold text-gray-500">Salon Name*</label><input maxLength={60} className="w-full p-2 border rounded-lg" value={newSalonData.salonName} onChange={e => setNewSalonData({ ...newSalonData, salonName: e.target.value })} /></div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="text-xs font-bold text-gray-500">Type</label><select className="w-full p-2 border rounded-lg" value={newSalonData.salonType} onChange={e => setNewSalonData({ ...newSalonData, salonType: e.target.value })}><option>Unisex</option><option>Male</option><option>Female</option></select></div>
                                            <div><label className="text-xs font-bold text-gray-500">Ownership</label><select className="w-full p-2 border rounded-lg" value={newSalonData.outletType} onChange={e => setNewSalonData({ ...newSalonData, outletType: e.target.value })}><option>Rent</option><option>Company Owned</option></select></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-gray-200">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><User size={18} className="text-purple-500" /> Owner & Location</h3>
                                    <div className="space-y-3">
                                        <div><label className="text-xs font-bold text-gray-500">Owner Name</label><input maxLength={50} className="w-full p-2 border rounded-lg" value={newSalonData.ownerName} onChange={e => setNewSalonData({ ...newSalonData, ownerName: e.target.value })} /></div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="text-xs font-bold text-gray-500">Phone*</label><input maxLength={15} className="w-full p-2 border rounded-lg" value={newSalonData.ownerPhone} onChange={e => setNewSalonData({ ...newSalonData, ownerPhone: e.target.value })} /></div>
                                            <div><label className="text-xs font-bold text-gray-500">Email (For OTP)*</label><input maxLength={50} type="email" placeholder="salon@gmail.com" className="w-full p-2 border rounded-lg" value={newSalonData.ownerEmail} onChange={e => setNewSalonData({ ...newSalonData, ownerEmail: e.target.value })} /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="text-xs font-bold text-gray-500">Area</label><input maxLength={40} className="w-full p-2 border rounded-lg" value={newSalonData.area} onChange={e => setNewSalonData({ ...newSalonData, area: e.target.value })} /></div>
                                            <div><label className="text-xs font-bold text-gray-500">City</label><input maxLength={40} className="w-full p-2 border rounded-lg" value={newSalonData.city} onChange={e => setNewSalonData({ ...newSalonData, city: e.target.value })} /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            <div><label className="text-xs font-bold text-gray-500">Pincode</label><input maxLength={10} type="text" placeholder="834001" className="w-full p-2 border rounded-lg" value={newSalonData.pincode} onChange={e => setNewSalonData({ ...newSalonData, pincode: e.target.value })} /></div>
                                            <div><label className="text-xs font-bold text-gray-500">Maps Link</label><input type="text" placeholder="https://maps..." className="w-full p-2 border rounded-lg" value={newSalonData.mapsLink} onChange={e => setNewSalonData({ ...newSalonData, mapsLink: e.target.value })} /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            <div><label className="text-xs font-bold text-gray-500">Latitude</label><input type="number" placeholder="23.377" className="w-full p-2 border rounded-lg" value={newSalonData.latitude} onChange={e => setNewSalonData({ ...newSalonData, latitude: e.target.value })} /></div>
                                            <div><label className="text-xs font-bold text-gray-500">Longitude</label><input type="number" placeholder="85.331" className="w-full p-2 border rounded-lg" value={newSalonData.longitude} onChange={e => setNewSalonData({ ...newSalonData, longitude: e.target.value })} /></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-gray-200">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Clock size={18} className="text-orange-500" /> Operations</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-xs font-bold text-gray-500">Open Time</label><input maxLength={15} className="w-full p-2 border rounded-lg" value={newSalonData.openTime} onChange={e => setNewSalonData({ ...newSalonData, openTime: e.target.value })} /></div>
                                        <div><label className="text-xs font-bold text-gray-500">Close Time</label><input maxLength={15} className="w-full p-2 border rounded-lg" value={newSalonData.closeTime} onChange={e => setNewSalonData({ ...newSalonData, closeTime: e.target.value })} /></div>
                                        <div><label className="text-xs font-bold text-gray-500">Weekly Off</label><select className="w-full p-2 border rounded-lg" value={newSalonData.weeklyOff} onChange={e => setNewSalonData({ ...newSalonData, weeklyOff: e.target.value })}><option>Mon</option><option>Tue</option><option>Sun</option><option>None</option></select></div>
                                    </div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-gray-200">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-green-500" /> Legal & Bank</h3>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="text-xs font-bold text-gray-500">GST No.</label><input maxLength={20} className="w-full p-2 border rounded-lg" value={newSalonData.gstNumber} onChange={e => setNewSalonData({ ...newSalonData, gstNumber: e.target.value })} /></div>
                                            <div><label className="text-xs font-bold text-gray-500">PAN No.</label><input maxLength={15} className="w-full p-2 border rounded-lg" value={newSalonData.panNumber} onChange={e => setNewSalonData({ ...newSalonData, panNumber: e.target.value })} /></div>
                                        </div>
                                        <div><label className="text-xs font-bold text-gray-500">UPI ID</label><input maxLength={40} className="w-full p-2 border rounded-lg" value={newSalonData.upiId} onChange={e => setNewSalonData({ ...newSalonData, upiId: e.target.value })} /></div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="text-xs font-bold text-gray-500">Account No.</label><input maxLength={25} className="w-full p-2 border rounded-lg" value={newSalonData.accountNumber} onChange={e => setNewSalonData({ ...newSalonData, accountNumber: e.target.value })} /></div>
                                            <div><label className="text-xs font-bold text-gray-500">IFSC</label><input maxLength={15} className="w-full p-2 border rounded-lg" value={newSalonData.ifscCode} onChange={e => setNewSalonData({ ...newSalonData, ifscCode: e.target.value })} /></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-white">
                            <button onClick={() => setIsAddingSalon(false)} className="px-6 py-3 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
                            <button onClick={handleCreateSalon} disabled={isSaving} className="px-8 py-3 font-bold text-white bg-black rounded-xl hover:bg-gray-800 flex items-center gap-2">{isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />} Create Salon</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedPartner && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex overflow-hidden">
                        <div className="w-72 bg-gray-50 border-r border-gray-200 p-6 flex flex-col gap-2 shrink-0 overflow-y-auto">
                            <div className="mb-6">
                                <div className="h-16 w-16 bg-white border border-gray-200 rounded-full flex items-center justify-center text-2xl font-bold text-gray-400 shadow-sm mb-3 shrink-0">{selectedPartner.displayName?.[0]}</div>
                                <h2 className="font-bold text-gray-900 leading-tight break-all" title={selectedPartner.displayName}>{selectedPartner.displayName}</h2>
                                <div className="mt-2 p-2 bg-gray-200 rounded text-[10px] font-mono break-all text-gray-600 select-all cursor-pointer hover:bg-gray-300" title="Click to copy" onClick={() => { navigator.clipboard.writeText(selectedPartner.id); alert("ID Copied!") }}>ID: {selectedPartner.id} <Copy size={10} className="inline ml-1 shrink-0" /></div>
                            </div>
                            <button onClick={() => setActiveTab('details')} className={`p-3 rounded-xl text-left text-sm font-bold flex items-center gap-3 transition-all ${activeTab === 'details' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}><Store size={18} /> Salon Details</button>
                            <button onClick={() => setActiveTab('bank')} className={`p-3 rounded-xl text-left text-sm font-bold flex items-center gap-3 transition-all ${activeTab === 'bank' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:bg-gray-100'}`}><Landmark size={18} /> Bank & KYC</button>
                            <button onClick={() => setActiveTab('menu')} className={`p-3 rounded-xl text-left text-sm font-bold flex items-center gap-3 transition-all ${activeTab === 'menu' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}><List size={18} /> Service Menu</button>
                            <button onClick={() => setActiveTab('team')} className={`p-3 rounded-xl text-left text-sm font-bold flex items-center gap-3 transition-all ${activeTab === 'team' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}><Briefcase size={18} /> Stylist Photos</button>
                            <button onClick={() => setActiveTab('offers')} className={`p-3 rounded-xl text-left text-sm font-bold flex items-center gap-3 transition-all ${activeTab === 'offers' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:bg-gray-100'}`}><Gift size={18} /> Offers & Ads</button>
                            <button onClick={() => setActiveTab('staff')} className={`p-3 rounded-xl text-left text-sm font-bold flex items-center gap-3 transition-all ${activeTab === 'staff' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}><Users size={18} /> Team Management</button>
                        </div>

                        <div className="flex-1 flex flex-col h-full overflow-hidden">
                            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
                                <h3 className="text-xl font-bold text-gray-800">
                                    {activeTab === 'details' && 'Edit Salon Details'}
                                    {activeTab === 'menu' && 'Manage Services'}
                                    {activeTab === 'team' && 'Stylist Photo Gallery'}
                                    {activeTab === 'offers' && 'Offers & Promo Codes'}
                                    {activeTab === 'staff' && 'Team Login Management'}
                                </h3>
                                <button onClick={() => setSelectedPartner(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} className="text-gray-500" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
                                {/* DETAILS TAB */}
                                {activeTab === 'details' && editFormData && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="md:col-span-2 bg-gray-50/80 p-5 rounded-xl border border-gray-200 shadow-sm">
                                                <div className="flex justify-between items-center mb-3">
                                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Manage Images ({editFormData.images?.length || 0})</label>
                                                    <span className="text-[10px] text-gray-400 font-bold bg-white px-2 py-1 rounded border">Add multiple photos</span>
                                                </div>
                                                <div className="flex flex-col gap-4">
                                                    {editFormData.images && editFormData.images.length > 0 ? (
                                                        <div className="flex flex-wrap gap-3">
                                                            {editFormData.images.map((imgUrl, index) => (
                                                                <div key={index} className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-white shadow-md shrink-0 group">
                                                                    <img src={imgUrl} alt={`Salon ${index}`} className="w-full h-full object-cover" />
                                                                    <button onClick={() => { const newImages = [...editFormData.images]; newImages.splice(index, 1); setEditFormData({ ...editFormData, images: newImages }); }} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500 backdrop-blur-md transition-all" title="Remove Image"><X size={12} /></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white text-gray-400 text-xs font-bold">No Images Added Yet</div>
                                                    )}
                                                    <div className="flex w-full gap-2 items-center mt-2">
                                                        <div className="relative flex-1 min-w-0">
                                                            <input type="file" accept="image/*" onChange={handleUploadSalonImage} disabled={isUploadingImage} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-900 file:text-white hover:file:bg-black cursor-pointer disabled:opacity-50 transition-all" />
                                                        </div>
                                                        {isUploadingImage && <div className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2.5 rounded-lg border border-blue-100 shadow-sm shrink-0"><Loader2 size={16} className="animate-spin" /> Uploading...</div>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Store size={18} className="text-blue-500" /> Basic Info</h4>
                                                <div className="space-y-3">
                                                    <div><label className="text-xs font-bold text-gray-500">Salon Name</label><input maxLength={60} className="w-full p-2 border rounded-lg" value={editFormData.salonName} onChange={e => setEditFormData({ ...editFormData, salonName: e.target.value })} /></div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><label className="text-xs font-bold text-gray-500">Type</label><select className="w-full p-2 border rounded-lg" value={editFormData.salonType} onChange={e => setEditFormData({ ...editFormData, salonType: e.target.value })}><option>Unisex</option><option>Male</option><option>Female</option></select></div>
                                                        <div><label className="text-xs font-bold text-gray-500">Ownership</label><select className="w-full p-2 border rounded-lg" value={editFormData.outletType} onChange={e => setEditFormData({ ...editFormData, outletType: e.target.value })}><option>Rent</option><option>Company Owned</option></select></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><User size={18} className="text-purple-500" /> Owner & Location</h4>
                                                <div className="space-y-3">
                                                    <div><label className="text-xs font-bold text-gray-500">Owner Name</label><input maxLength={50} className="w-full p-2 border rounded-lg" value={editFormData.ownerName} onChange={e => setEditFormData({ ...editFormData, ownerName: e.target.value })} /></div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><label className="text-xs font-bold text-gray-500">Phone</label><input maxLength={15} className="w-full p-2 border rounded-lg" value={editFormData.ownerPhone} onChange={e => setEditFormData({ ...editFormData, ownerPhone: e.target.value })} /></div>
                                                        <div><label className="text-xs font-bold text-gray-500">Email</label><input maxLength={50} type="email" className="w-full p-2 border rounded-lg" value={editFormData.ownerEmail} onChange={e => setEditFormData({ ...editFormData, ownerEmail: e.target.value })} /></div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div><label className="text-xs font-bold text-gray-500">Area</label><input maxLength={40} className="w-full p-2 border rounded-lg" value={editFormData.area} onChange={e => setEditFormData({ ...editFormData, area: e.target.value })} /></div>
                                                        <div><label className="text-xs font-bold text-gray-500">City</label><input maxLength={40} className="w-full p-2 border rounded-lg" value={editFormData.city} onChange={e => setEditFormData({ ...editFormData, city: e.target.value })} /></div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 mt-3">
                                                        <div><label className="text-xs font-bold text-gray-500">Pincode</label><input maxLength={10} type="text" placeholder="834001" className="w-full p-2 border rounded-lg" value={editFormData.pincode} onChange={e => setEditFormData({ ...editFormData, pincode: e.target.value })} /></div>
                                                        <div><label className="text-xs font-bold text-gray-500">Maps Link</label><input type="text" placeholder="https://maps..." className="w-full p-2 border rounded-lg" value={editFormData.mapsLink} onChange={e => setEditFormData({ ...editFormData, mapsLink: e.target.value })} /></div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 mt-3">
                                                        <div><label className="text-xs font-bold text-gray-500">Latitude</label><input type="number" placeholder="23.377" className="w-full p-2 border rounded-lg" value={editFormData.latitude} onChange={e => setEditFormData({ ...editFormData, latitude: e.target.value })} /></div>
                                                        <div><label className="text-xs font-bold text-gray-500">Longitude</label><input type="number" placeholder="85.331" className="w-full p-2 border rounded-lg" value={editFormData.longitude} onChange={e => setEditFormData({ ...editFormData, longitude: e.target.value })} /></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Clock size={18} className="text-orange-500" /> Operations</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div><label className="text-xs font-bold text-gray-500">Open Time</label><input maxLength={15} className="w-full p-2 border rounded-lg" value={editFormData.openTime} onChange={e => setEditFormData({ ...editFormData, openTime: e.target.value })} /></div>
                                                    <div><label className="text-xs font-bold text-gray-500">Close Time</label><input maxLength={15} className="w-full p-2 border rounded-lg" value={editFormData.closeTime} onChange={e => setEditFormData({ ...editFormData, closeTime: e.target.value })} /></div>
                                                    <div><label className="text-xs font-bold text-gray-500">Weekly Off</label><select className="w-full p-2 border rounded-lg" value={editFormData.weeklyOff} onChange={e => setEditFormData({ ...editFormData, weeklyOff: e.target.value })}><option>Mon</option><option>Tue</option><option>Sun</option><option>None</option></select></div>
                                                </div>
                                            </div>
                                            
                                        </div>
                                        <div className="flex justify-end">
                                            <button onClick={handleUpdateDetails} disabled={isSaving} className="px-8 py-3 font-bold text-white bg-gray-900 rounded-xl hover:bg-black flex items-center gap-2 shadow-lg">{isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />} Save All Changes</button>
                                        </div>
                                    </div>
                                )}

                                {/* MENU TAB */}
                                {activeTab === 'menu' && (
                                    <div className="space-y-6">
                                        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-bold text-blue-900 flex items-center gap-2"><Plus size={18} /> Add New Service</h4>
                                                <button onClick={() => { setHasVariants(!hasVariants); setVariantList([{ name: "", price: "", time: "30" }]); }} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${hasVariants ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300'}`}>
                                                    {hasVariants ? "Variants Enabled" : "Enable Variants?"}
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start mb-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Service Name</label>
                                                    <input maxLength={60} type="text" placeholder="e.g. Hair Spa" className="w-full p-2.5 rounded-lg border border-blue-200 outline-none" value={newService.name} onChange={e => setNewService({ ...newService, name: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Service Photo (Upload)</label>
                                                    <input type="file" accept="image/*" className="w-full p-2 rounded-lg border border-blue-200 text-sm bg-white file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer" onChange={(e) => setImageFile(e.target.files[0])} />
                                                </div>
                                                
                                                {/* 🔥 UPDATE: Subtext box added here */}
                                                <div className="md:col-span-2">
                                                    <label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Subtext / Description (Optional)</label>
                                                    <input maxLength={60} type="text" placeholder="e.g. Price may vary as per hair length" className="w-full p-2.5 rounded-lg border border-blue-200 outline-none" value={newService.subtext || ""} onChange={e => setNewService({ ...newService, subtext: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <label className="text-[10px] font-bold text-blue-500 uppercase mb-2 block">Target Audience</label>
                                                <div className="flex gap-2">
                                                    {['Unisex', 'Men', 'Women', 'Kids'].map(target => (
                                                        <button key={target} onClick={() => setNewService({ ...newService, targetGender: target })} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${newService.targetGender === target ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                                                            {target}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <label className="text-[10px] font-bold text-blue-500 uppercase mb-2 block">Category</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {CATEGORIES.map(cat => (
                                                        <button key={cat} onClick={() => setNewService({ ...newService, category: cat })} className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${newService.category === cat ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                                                            {cat}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Standard (Base) Price (₹)</label>
                                                    <input type="number" placeholder="150" className="w-full p-2.5 rounded-lg border border-blue-200 outline-none" value={newService.price} onChange={e => setNewService({ ...newService, price: e.target.value })} />
                                                    
                                                    {/* 🔥 UPDATE: Main Price GST Breakdown */}
                                                    {calculateGSTBreakdown(newService.price) && (
                                                        <div className="mt-1.5 bg-green-50 p-2 rounded-lg border border-green-200">
                                                            <p className="text-[10px] text-green-800 font-bold mb-0.5">Incl. {calculateGSTBreakdown(newService.price).rate}% GST</p>
                                                            <p className="text-[9px] text-green-700 font-medium">Base: ₹{calculateGSTBreakdown(newService.price).base} | Tax: ₹{calculateGSTBreakdown(newService.price).tax}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Time (Mins)</label>
                                                    <input type="number" placeholder="30" className="w-full p-2.5 rounded-lg border border-blue-200 outline-none" value={newService.time} onChange={e => setNewService({ ...newService, time: e.target.value })} />
                                                </div>
                                            </div>

                                            {hasVariants && (
                                                <div className="bg-white p-3 rounded-xl border border-blue-100 mb-3">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Service Variants</label>
                                                    {variantList.map((v, index) => (
                                                        <div key={index} className="flex flex-col gap-1 mb-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
                                                            <div className="flex gap-2 items-center">
                                                                <input maxLength={40} type="text" placeholder="Name (e.g. Gold)" className="flex-1 p-2 text-sm border rounded bg-white min-w-0" value={v.name} onChange={(e) => handleVariantChange(index, 'name', e.target.value)} />
                                                                <input type="number" placeholder="Price" className="w-24 p-2 text-sm border rounded bg-white shrink-0" value={v.price} onChange={(e) => handleVariantChange(index, 'price', e.target.value)} />
                                                                <div className="relative w-24 shrink-0">
                                                                    <Clock size={12} className="absolute left-2 top-3 text-gray-400" />
                                                                    <input type="number" placeholder="Min" className="w-full pl-6 p-2 text-sm border rounded bg-white" value={v.time} onChange={(e) => handleVariantChange(index, 'time', e.target.value)} />
                                                                </div>
                                                                {variantList.length > 1 && <button onClick={() => removeVariantRow(index)} className="text-red-400 hover:text-red-600 shrink-0 p-1"><Trash2 size={16} /></button>}
                                                            </div>
                                                            
                                                            {/* 🔥 UPDATE: Variant GST Breakdown */}
                                                            {calculateGSTBreakdown(v.price) && (
                                                                <div className="bg-green-50 px-2 py-1 rounded border border-green-200 w-full mt-1">
                                                                    <p className="text-[9px] text-green-800 font-bold">
                                                                        Incl. {calculateGSTBreakdown(v.price).rate}% GST 
                                                                        <span className="font-normal text-green-700 ml-1">| Base: ₹{calculateGSTBreakdown(v.price).base} | Tax: ₹{calculateGSTBreakdown(v.price).tax}</span>
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <button onClick={addVariantRow} className="text-xs text-blue-600 font-bold hover:underline">+ Add Another Variant</button>
                                                </div>
                                            )}

                                            <button onClick={handleAddService} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg font-bold flex justify-center items-center shadow-md transition-all">
                                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />} Save Service
                                            </button>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                            <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-gray-500 text-xs uppercase tracking-wider flex justify-between">
                                                <span>Current Menu ({serviceList.length || 0} items)</span>
                                            </div>
                                            <div className="divide-y divide-gray-100">
                                                {isFetchingServices ? (
                                                    <div className="p-8 text-center flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
                                                ) : serviceList.length === 0 ? (
                                                    <div className="p-8 text-center text-gray-400 italic">No services found.</div>
                                                ) : (
                                                    serviceList.map((service) => (
                                                        <div key={service.id} className="p-4 hover:bg-gray-50 group transition-colors">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                                    <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 overflow-hidden border shrink-0">
                                                                        {service.image ? <img src={service.image} alt="Service" className="w-full h-full object-cover" /> : (service.isCustomizable ? <Layers size={20} /> : <Store size={20} />)}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <h5 className="font-bold text-gray-900 truncate" title={service.name || service.serviceName}>{service.name || service.serviceName}</h5>
                                                                        
                                                                        {/* 🔥 UPDATE: Showing subtext in menu list */}
                                                                        {service.subtext && <p className="text-[10px] text-gray-500 truncate" title={service.subtext}>{service.subtext}</p>}
                                                                        
                                                                        <div className="flex gap-2 text-xs mt-1">
                                                                            {service.category && <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium border border-red-100">{service.category}</span>}
                                                                            {!service.isCustomizable && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock size={10} /> {service.time}m</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-6 shrink-0">
                                                                    {service.isCustomizable ? (
                                                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">{service.variants?.length} Variants</span>
                                                                    ) : (
                                                                        <span className="font-bold text-gray-900 text-lg">₹{service.price}</span>
                                                                    )}
                                                                    <button onClick={() => handleDeleteService(service.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg" title="Delete"><Trash2 size={18} /></button>
                                                                </div>
                                                            </div>
                                                            {service.isCustomizable && service.variants && (
                                                                <div className="mt-3 ml-16 bg-gray-50 rounded-lg p-3 border border-gray-100 text-sm">
                                                                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Options Available</p>
                                                                    {service.variants.map((v, idx) => (
                                                                        <div key={idx} className="flex justify-between py-1 border-b border-gray-200 last:border-0 gap-4">
                                                                            <span className="text-gray-700 font-medium truncate flex-1 min-w-0" title={v.name}>{v.name}</span>
                                                                            <div className="flex gap-3 shrink-0">
                                                                                <span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={10} /> {v.time}m</span>
                                                                                <span className="font-bold text-gray-900">₹{v.price}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TEAM TAB (Stylist Photos) */}
                                {activeTab === 'team' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><User size={18} className="text-blue-500" /> Add Stylist Photo</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Full Name</label><input maxLength={40} type="text" placeholder="e.g. Rahul Mahto" className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" value={newStylist.name} onChange={e => setNewStylist({ ...newStylist, name: e.target.value })} /></div>
                                                <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Specialization (Role)</label><input maxLength={30} type="text" placeholder="e.g. Barber / Makeup Artist" className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" value={newStylist.role} onChange={e => setNewStylist({ ...newStylist, role: e.target.value })} /></div>
                                            </div>
                                            <div className="mb-4"><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Stylist Photo (Optional)</label><input id="stylist-file-input" type="file" accept="image/*" className="w-full p-2 rounded-lg border border-gray-200 text-sm bg-gray-50 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer" onChange={(e) => setStylistImageFile(e.target.files[0])} /></div>
                                            <button onClick={handleAddStylist} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg font-bold flex justify-center items-center shadow-md transition-all">{isSaving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />} Add Photo</button>
                                        </div>
                                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                            <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-gray-500 text-xs uppercase tracking-wider flex justify-between">
                                                <span>Stylist Photos ({(editFormData?.team || []).length})</span>
                                            </div>
                                            <div className="divide-y divide-gray-100">
                                                {!(editFormData?.team) || editFormData.team.length === 0 ? (
                                                    <div className="p-10 text-center text-gray-400 italic">No stylist photos added.</div>
                                                ) : (
                                                    editFormData.team.map((stylist) => (
                                                        <div key={stylist.id} className="p-4 hover:bg-gray-50 flex items-center justify-between group transition-colors gap-4">
                                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                                <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 overflow-hidden border-2 border-white shadow-sm shrink-0">
                                                                    {stylist.image ? <img src={stylist.image} alt={stylist.name} className="w-full h-full object-cover" /> : <User size={20} />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h5 className="font-bold text-gray-900 truncate" title={stylist.name}>{stylist.name}</h5>
                                                                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5 truncate" title={stylist.role}><Scissors size={12} className="shrink-0" /> <span className="truncate">{stylist.role}</span></div>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => handleDeleteStylist(stylist.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg transition-colors shrink-0" title="Remove Photo"><Trash2 size={18} /></button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* OFFERS TAB */}
                                {activeTab === 'offers' && (
                                    <div className="space-y-6">
                                        <div className="bg-red-50/30 p-6 rounded-2xl border border-red-100">
                                            <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2"><Layers size={18} /> Homescreen Banner Ad</h4>
                                            <p className="text-sm text-red-600/80 mb-5">Shows at the top of the salon card on the customer app to drive bookings.</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div><label className="text-[10px] font-bold text-red-500 uppercase mb-1 block">Highlight Badge (Short Text)</label><input type="text" placeholder="e.g. 20% OFF" className="w-full p-2.5 rounded-lg border border-red-200 outline-none bg-white focus:ring-2 focus:ring-red-400" maxLength={15} value={bannerBadge} onChange={e => setBannerBadge(e.target.value)} /></div>
                                                <div><label className="text-[10px] font-bold text-red-500 uppercase mb-1 block">Detailed Offer Text</label><input maxLength={60} type="text" placeholder="e.g. FLAT 20% OFF on haircut..." className="w-full p-2.5 rounded-lg border border-red-200 outline-none bg-white focus:ring-2 focus:ring-red-400" value={bannerText} onChange={e => setBannerText(e.target.value)} /></div>
                                            </div>
                                            <button onClick={handleSaveBanner} disabled={isSavingBanner} className="w-full bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-lg font-bold flex justify-center items-center shadow-sm transition-all">{isSavingBanner ? <Loader2 size={20} className="animate-spin" /> : "Save Banner Details"}</button>
                                        </div>

                                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Banknote size={18} className="text-blue-500" /> Create Promo Code</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Coupon Code</label><input maxLength={20} type="text" placeholder="e.g. FESTIVE50" className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 uppercase" value={newPromo.code} onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })} /></div>
                                                <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Discount Type</label><select className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={newPromo.type} onChange={e => setNewPromo({ ...newPromo, type: e.target.value })}><option value="percentage">Percentage (%)</option><option value="flat">Flat Amount (₹)</option></select></div>
                                                <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Discount Value</label><input type="number" placeholder={newPromo.type === 'percentage' ? "e.g. 20" : "e.g. 100"} className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500" value={newPromo.value} onChange={e => setNewPromo({ ...newPromo, value: e.target.value })} /></div>
                                                <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Min Order Value (₹)</label><input type="number" placeholder="e.g. 500" className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500" value={newPromo.minOrder} onChange={e => setNewPromo({ ...newPromo, minOrder: e.target.value })} /></div>
                                                {newPromo.type === 'percentage' && <div><label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Max Discount (₹)</label><input type="number" placeholder="Optional. e.g. 150" className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500" value={newPromo.maxDiscount} onChange={e => setNewPromo({ ...newPromo, maxDiscount: e.target.value })} /></div>}
                                            </div>
                                            <button onClick={handleAddPromoCode} disabled={isSavingPromo} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg font-bold flex justify-center items-center shadow-md transition-all mt-2">{isSavingPromo ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />} Add Promo Code</button>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                            <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-gray-500 text-xs uppercase tracking-wider flex justify-between"><span>Active Promo Codes ({promoCodes.length})</span></div>
                                            <div className="divide-y divide-gray-100">
                                                {isFetchingPromo ? (
                                                    <div className="p-8 text-center flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
                                                ) : promoCodes.length === 0 ? (
                                                    <div className="p-10 text-center text-gray-400 italic">No promo codes found for this salon.</div>
                                                ) : (
                                                    promoCodes.map((promo) => (
                                                        <div key={promo.id} className="p-4 hover:bg-gray-50 flex items-center justify-between group transition-colors gap-4">
                                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                                <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 border border-blue-100 shrink-0"><Banknote size={20} /></div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h5 className="font-bold text-gray-900 text-lg tracking-wider truncate" title={promo.id}>{promo.id}</h5>
                                                                    <div className="flex flex-col gap-1 text-xs text-gray-500 mt-1">
                                                                        <span className="font-medium text-green-600">{promo.discountType === 'percentage' ? `${promo.discountValue}% OFF` : `FLAT ₹${promo.discountValue} OFF`}{promo.maxDiscount ? ` (Upto ₹${promo.maxDiscount})` : ''}</span>
                                                                        <span>Valid above ₹{promo.minOrderValue}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => handleDeletePromo(promo.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg transition-colors shrink-0" title="Delete Promo Code"><Trash2 size={20} /></button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STAFF TAB */}
                                {activeTab === 'staff' && (
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                            <h4 className="font-bold text-gray-900 mb-4 text-lg">Add New Team Member</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                                <div><label className="text-[11px] font-bold text-gray-500 uppercase mb-1.5 block">Full Name</label><input type="text" placeholder="e.g. Rahul Sharma" maxLength={40} className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-red-500" value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} /></div>
                                                <div><label className="text-[11px] font-bold text-gray-500 uppercase mb-1.5 block">Phone Number (Login ID)</label><input type="tel" placeholder="10 digit mobile number" maxLength={10} className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-red-500" value={newStaff.phone} onChange={e => setNewStaff({ ...newStaff, phone: e.target.value.replace(/[^0-9]/g, '') })} /></div>
                                                <div><label className="text-[11px] font-bold text-gray-500 uppercase mb-1.5 block">Login Password</label><input type="text" placeholder="e.g. rahul123" maxLength={40} className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-red-500" value={newStaff.password} onChange={e => setNewStaff({ ...newStaff, password: e.target.value })} /><p className="text-[10px] text-gray-400 mt-1">Mix of letters & numbers (min 6 chars).</p></div>
                                                <div><label className="text-[11px] font-bold text-gray-500 uppercase mb-1.5 block">Role</label><select className="w-full p-2.5 rounded-lg border border-gray-200 outline-none bg-gray-50 text-gray-500 cursor-not-allowed" value={newStaff.role} disabled><option value="manager">Manager (Only Bookings & Billing)</option></select></div>
                                            </div>
                                            <button onClick={handleAddStaffAccount} disabled={isSaving} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-bold flex justify-center items-center shadow-md transition-all w-fit">{isSaving ? <Loader2 size={18} className="animate-spin mr-2" /> : null} Create Login Access</button>
                                        </div>
                                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6">
                                            <h4 className="font-bold text-gray-900 mb-6 text-lg">Active Staff Accounts</h4>
                                            {isFetchingStaff ? (
                                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
                                            ) : staffList.length === 0 ? (
                                                <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                                    <p className="text-gray-500 font-medium">No staff added yet.</p>
                                                    <p className="text-sm text-gray-400 mt-1">Add someone above to give them portal access.</p>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                                    <table className="w-full text-left table-auto">
                                                        <thead className="bg-gray-50 border-b border-gray-200">
                                                            <tr>
                                                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Phone (Login ID)</th>
                                                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Password</th>
                                                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                                                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {staffList.map((staff) => (
                                                                <tr key={staff.id} className={`hover:bg-gray-50/50 transition-colors ${!staff.isActive ? 'opacity-60 bg-gray-50/80' : ''}`}>
                                                                    <td className="p-4 font-bold text-gray-900">{staff.name}</td>
                                                                    <td className="p-4 font-medium text-gray-600">{staff.phone}</td>
                                                                    <td className="p-4 text-gray-500 font-mono text-sm">{staff.password}</td>
                                                                    <td className="p-4"><span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[11px] font-bold uppercase tracking-wide">{staff.role}</span></td>
                                                                    <td className="p-4">{staff.isActive ? <span className="text-emerald-700 font-bold text-xs bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">Active</span> : <span className="text-red-700 font-bold text-xs bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">Blocked</span>}</td>
                                                                    <td className="p-4">
                                                                        <div className="flex items-center justify-center gap-6">
                                                                            <button onClick={() => handleToggleStaffStatus(staff.phone, staff.isActive, staff.name)} title={staff.isActive ? "Block User" : "Unblock User"} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${staff.isActive ? 'bg-green-500' : 'bg-gray-300'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${staff.isActive ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                                                                            <button onClick={() => handleDeleteStaffAccount(staff.phone, staff.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all" title="Delete Permanently"><Trash2 size={20} /></button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 🔥 ---------------- NEW TAB: BANK & KYC ---------------- 🔥 */}
                                {activeTab === 'bank' && editFormData && (
                                    <div className="space-y-8 animate-in fade-in duration-200">
                                        
                                        {/* Bank Account Info */}
                                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                            <h4 className="font-bold text-gray-900 mb-6 text-lg border-b border-gray-100 pb-3">Bank Account Info</h4>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <div><label className="text-[11px] font-bold text-gray-500 uppercase block mb-1.5">Account Holder Name</label><input maxLength={50} className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-green-500 bg-gray-50" value={editFormData.accountName} onChange={e => setEditFormData({ ...editFormData, accountName: e.target.value })} /></div>
                                                    <div><label className="text-[11px] font-bold text-gray-500 uppercase block mb-1.5">Account Number</label><input maxLength={25} className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-green-500 bg-gray-50" value={editFormData.accountNumber} onChange={e => setEditFormData({ ...editFormData, accountNumber: e.target.value.replace(/\D/g, '') })} /></div>
                                                    <div><label className="text-[11px] font-bold text-gray-500 uppercase block mb-1.5">IFSC Code</label><input maxLength={15} className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 uppercase" value={editFormData.ifscCode} onChange={e => setEditFormData({ ...editFormData, ifscCode: e.target.value.toUpperCase() })} /></div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1.5">Passbook / Cancelled Cheque</label>
                                                    <div className="relative w-full flex-1 min-h-[160px] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center overflow-hidden hover:border-green-500 transition-colors">
                                                        <input type="file" accept="image/*" onChange={(e) => handleUploadBankDoc(e, 'passbook')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                                        {editFormData.passbookUrl ? (
                                                            <img src={editFormData.passbookUrl} className="w-full h-full object-contain p-2 mix-blend-multiply" alt="Passbook" />
                                                        ) : (
                                                            <>
                                                                <UploadCloud size={28} className="text-gray-400 mb-2" />
                                                                <span className="text-sm font-bold text-gray-500">Upload Image</span>
                                                            </>
                                                        )}
                                                        {isUploadingImage && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20"><Loader2 className="animate-spin text-green-600" size={24} /></div>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tax & KYC Info */}
                                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                            <h4 className="font-bold text-gray-900 mb-6 text-lg border-b border-gray-100 pb-3">Tax & KYC Info</h4>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <div><label className="text-[11px] font-bold text-gray-500 uppercase block mb-1.5">PAN Card Number</label><input maxLength={10} className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 uppercase" value={editFormData.panNumber} onChange={e => setEditFormData({ ...editFormData, panNumber: e.target.value.toUpperCase() })} /></div>
                                                    
                                                    <div className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg p-3">
                                                        <div>
                                                            <h3 className="text-[13px] font-bold text-gray-800">GST Registered?</h3>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input type="checkbox" className="sr-only peer" checked={editFormData.gstRegistered} onChange={(e) => setEditFormData({ ...editFormData, gstRegistered: e.target.checked })} />
                                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                                        </label>
                                                    </div>

                                                    {editFormData.gstRegistered && (
                                                        <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                                                            <div><label className="text-[11px] font-bold text-gray-500 uppercase block mb-1.5">GST Number</label><input maxLength={15} className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 uppercase" value={editFormData.gstNumber} onChange={e => setEditFormData({ ...editFormData, gstNumber: e.target.value.toUpperCase() })} /></div>
                                                            <div><label className="text-[11px] font-bold text-gray-500 uppercase block mb-1.5">GST Rate (%)</label><input type="number" className="w-full p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-green-500 bg-gray-50" value={editFormData.gstRate} onChange={e => setEditFormData({ ...editFormData, gstRate: e.target.value })} /></div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1.5">PAN Card Photo</label>
                                                    <div className="relative w-full flex-1 min-h-[160px] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center overflow-hidden hover:border-green-500 transition-colors">
                                                        <input type="file" accept="image/*" onChange={(e) => handleUploadBankDoc(e, 'pan')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                                        {editFormData.panUrl ? (
                                                            <img src={editFormData.panUrl} className="w-full h-full object-contain p-2 mix-blend-multiply" alt="PAN" />
                                                        ) : (
                                                            <>
                                                                <UploadCloud size={28} className="text-gray-400 mb-2" />
                                                                <span className="text-sm font-bold text-gray-500">Upload Image</span>
                                                            </>
                                                        )}
                                                        {isUploadingImage && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20"><Loader2 className="animate-spin text-green-600" size={24} /></div>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* UPI Details */}
                                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                            <h4 className="font-bold text-gray-900 mb-6 text-lg border-b border-gray-100 pb-3">UPI Details (Optional)</h4>
                                            <div><label className="text-[11px] font-bold text-gray-500 uppercase block mb-1.5">UPI ID / VPA</label><input maxLength={40} className="w-full md:w-1/2 p-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-green-500 bg-gray-50" value={editFormData.upiId} onChange={e => setEditFormData({ ...editFormData, upiId: e.target.value })} placeholder="e.g. 9876543210@ybl" /></div>
                                        </div>

                                        <div className="flex justify-end pt-4">
                                            <button onClick={handleUpdateDetails} disabled={isSaving || isUploadingImage} className="px-8 py-3 font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 flex items-center gap-2 shadow-lg transition-colors">
                                                {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />} Save KYC Details
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}