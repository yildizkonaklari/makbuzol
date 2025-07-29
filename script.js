// Firebase servislerini import et
// firebase-config.js dosyasından zaten global olarak alınmış olacaklar
// const auth = firebase.auth();
// const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    // Giriş Kontrolü
    auth.onAuthStateChanged(user => {
        if (!user && window.location.pathname.endsWith('index.html')) {
            window.location.href = 'login.html'; // Giriş yapılmadıysa login sayfasına yönlendir
        } else if (user && window.location.pathname.endsWith('login.html')) {
            window.location.href = 'index.html'; // Giriş yapıldıysa ana sayfaya yönlendir
        }
        // Eğer login.html'deysek ve kullanıcı yoksa bir şey yapmaya gerek yok
    });

    // Login Sayfası İşlemleri
    if (document.getElementById('loginButton')) {
        document.getElementById('loginButton').addEventListener('click', async () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('errorMessage');

            try {
                await auth.signInWithEmailAndPassword(email, password);
                // Başarılı girişten sonra index.html'ye yönlendirme auth.onAuthStateChanged tarafından yapılacak
            } catch (error) {
                errorMessage.textContent = 'Giriş Başarısız: ' + error.message;
            }
        });
    }

    // Ana Sayfa İşlemleri (sadece index.html üzerinde çalışacak)
    if (document.getElementById('addPaymentButton')) {
        const addPaymentButton = document.getElementById('addPaymentButton');
        const paymentForm = document.getElementById('paymentForm');
        const savePaymentButton = document.getElementById('savePaymentButton');
        const cancelPaymentButton = document.getElementById('cancelPaymentButton');
        const recentPaymentsDiv = document.getElementById('recentPayments');

        addPaymentButton.addEventListener('click', () => {
            paymentForm.classList.remove('hidden');
            addPaymentButton.classList.add('hidden'); // Ödeme ekle butonunu gizle
        });

        cancelPaymentButton.addEventListener('click', () => {
            paymentForm.classList.add('hidden');
            addPaymentButton.classList.remove('hidden'); // Ödeme ekle butonunu göster
            clearForm();
        });

        savePaymentButton.addEventListener('click', async () => {
            const payerName = document.getElementById('payerName').value;
            const childName = document.getElementById('childName').value;
            const paymentDescription = document.getElementById('paymentDescription').value;
            const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
            const phoneNumber = document.getElementById('phoneNumber').value;
            const paymentMethod = document.getElementById('paymentMethod').value;
            const paymentDate = new Date(); // Bugünün tarihi

            if (!payerName || isNaN(paymentAmount) || !phoneNumber) {
                alert('Lütfen tüm zorunlu alanları doldurun: Ödeme Yapan Kişi, Tutar, Telefon Numarası.');
                return;
            }

            const paymentData = {
                payerName,
                childName,
                paymentDescription,
                paymentAmount,
                phoneNumber,
                paymentMethod,
                paymentDate: firebase.firestore.Timestamp.fromDate(paymentDate), // Firebase Timestamp olarak kaydet
                userId: auth.currentUser.uid // Ödemeyi yapan kullanıcının ID'si
            };

            try {
                await db.collection('payments').add(paymentData);
                alert('Ödeme başarıyla kaydedildi!');
                clearForm();
                paymentForm.classList.add('hidden');
                addPaymentButton.classList.remove('hidden');
                loadRecentPayments(); // Ödemeleri yeniden yükle
                
                // Makbuz gönderme sorusu
                const sendReceipt = confirm('Makbuzu WhatsApp\'a göndermek istiyor musunuz?');
                if (sendReceipt) {
                    sendWhatsAppReceipt(paymentData);
                }

            } catch (error) {
                console.error('Ödeme kaydedilirken hata oluştu: ', error);
                alert('Ödeme kaydedilirken bir hata oluştu.');
            }
        });

        // Son eklenen ödemeleri yükle
        async function loadRecentPayments() {
            recentPaymentsDiv.innerHTML = ''; // Önceki ödemeleri temizle
            try {
                // Sadece mevcut kullanıcının ödemelerini ve en son 5 tanesini yükle
                const snapshot = await db.collection('payments')
                                        .where('userId', '==', auth.currentUser.uid)
                                        .orderBy('paymentDate', 'desc')
                                        .limit(5)
                                        .get();
                
                if (snapshot.empty) {
                    recentPaymentsDiv.innerHTML = '<p>Henüz ödeme eklenmedi.</p>';
                    return;
                }

                snapshot.forEach(doc => {
                    const payment = doc.data();
                    const paymentDate = payment.paymentDate.toDate().toLocaleDateString('tr-TR'); // Tarihi okunur formatta al

                    const paymentItem = document.createElement('div');
                    paymentItem.classList.add('payment-item');
                    paymentItem.innerHTML = `
                        <p><strong>Ödeyen:</strong> ${payment.payerName}</p>
                        <p><strong>Çocuk:</strong> ${payment.childName || 'Yok'}</p>
                        <p><strong>Tutar:</strong> ${payment.paymentAmount} TL</p>
                        <p><strong>Açıklama:</strong> ${payment.paymentDescription}</p>
                        <p><strong>Ödeme Şekli:</strong> ${payment.paymentMethod}</p>
                        <p><strong>Tarih:</strong> ${paymentDate}</p>
                    `;
                    recentPaymentsDiv.appendChild(paymentItem);
                });
            } catch (error) {
                console.error('Son ödemeler yüklenirken hata oluştu: ', error);
                recentPaymentsDiv.innerHTML = '<p>Ödemeler yüklenirken bir hata oluştu.</p>';
            }
        }

        // Formu temizleme fonksiyonu
        function clearForm() {
            document.getElementById('payerName').value = '';
            document.getElementById('childName').value = '';
            document.getElementById('paymentDescription').value = '';
            document.getElementById('paymentAmount').value = '';
            document.getElementById('phoneNumber').value = '';
            document.getElementById('paymentMethod').value = 'Nakit';
        }

        // WhatsApp Makbuz Gönderme Fonksiyonu
        // Not: Bu kısım doğrudan tarayıcıdan WhatsApp API'sine erişemez.
        // Güvenli ve stabil bir çözüm için Firebase Functions gibi bir arka uç servisi gerekir.
        // Aşağıdaki örnek, sadece WhatsApp Web'e yönlendirme amaçlı basit bir çözümdür.
        // Gerçek bir API entegrasyonu için daha fazla geliştirme gereklidir.
        function sendWhatsAppReceipt(payment) {
            const formattedDate = payment.paymentDate.toDate().toLocaleDateString('tr-TR');
            const message = `Makbuz Bilgileri:\n` +
                            `-----------------------------------\n` +
                            `Ödeyen Kişi: ${payment.payerName}\n` +
                            `Çocuk Adı: ${payment.childName || 'Belirtilmedi'}\n` +
                            `Ödeme Tutarı: ${payment.paymentAmount} TL\n` +
                            `Ödeme Açıklaması: ${payment.paymentDescription}\n` +
                            `Ödeme Şekli: ${payment.paymentMethod}\n` +
                            `Ödeme Tarihi: ${formattedDate}\n` +
                            `-----------------------------------\n` +
                            `Teşekkür ederiz!`;

            // WhatsApp telefon numarasına göre link oluşturma (Türkiye için +90 ile başlamalı)
            // Eğer numara başında 0 varsa veya ülke kodu yoksa eklenmeli
            let whatsappNum = payment.phoneNumber.replace(/\s/g, ''); // Boşlukları kaldır
            if (whatsappNum.startsWith('0')) {
                whatsappNum = '90' + whatsappNum.substring(1); // 0'ı kaldırıp 90 ekle
            } else if (!whatsappNum.startsWith('90')) {
                 whatsappNum = '90' + whatsappNum; // Başında 90 yoksa ekle (Basit varsayım)
            }
            
            const whatsappUrl = `https://wa.me/${whatsappNum}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        }

        // Sayfa yüklendiğinde ödemeleri çek
        // auth.onAuthStateChanged içinde çağırılacak ki kullanıcı bilgisi gelsin.
        auth.onAuthStateChanged(user => {
            if (user && window.location.pathname.endsWith('index.html')) {
                loadRecentPayments();
            }
        });
    }
});
