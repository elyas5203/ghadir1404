document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyeUokv2jdQRw7Q3owcu4mV3XPgBpYI5676KzA-hqDyMKw4Z_6UWNUv2aWsR6tuLvc/exec"; // URL شما
    const ADMIN_USERNAME_VALUE = "ghadir";
    const ADMIN_PASSWORD_PHONE_VALUE = "110";
    const ADMIN_API_TOKEN = "ADMIN_SECRET_TOKEN_110";

    const timeSlots = {
        sakht: {
            name: "ساخت",
            days: ["13", "14", "15", "16", "17", "18"],
            slots: ["06:00-09:00", "09:00-15:00", "15:00-21:00", "21:00-03:00"]
        },
        ejra: {
            name: "اجرا",
            days: ["19", "20", "21", "22", "23", "24", "25", "26"],
            slots: ["10:00-14:00", "14:00-18:00", "18:00-22:00"]
        },
        jamavari: {
            name: "جمع آوری",
            days: ["27", "28", "29", "30"],
            slots: ["06:00-09:00", "09:00-15:00", "15:00-21:00", "21:00-03:00"]
        }
    };

    // --- STATE ---
    let currentSelections = [];
    let isAdminLoggedIn = false;

    // --- DOM ELEMENTS ---
    const welcomeMessageSection = document.getElementById('welcome-message');
    const timeTableSections = document.querySelectorAll('.time-table-section'); // انتخاب تمام بخش های جدول زمانی
    const finalizeBtn = document.getElementById('finalize-btn');
    const adminPanelBtn = document.getElementById('admin-panel-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const adminPanelSection = document.getElementById('admin-panel-section');
    const adminActionsDiv = document.querySelector('#admin-panel-section .admin-actions');
    const adminViewAllRegistrationsBtn = document.getElementById('admin-view-all-users-btn');
    const adminViewAggregatedReportBtn = document.getElementById('admin-view-aggregated-report-btn');
    const adminContentArea = document.getElementById('admin-content-area');
    const logoutAdminBtn = document.getElementById('logout-admin-btn');

    const userDataModal = document.getElementById('user-data-modal');
    const closeUserDataModalBtn = userDataModal ? userDataModal.querySelector('#close-user-data-modal') : null;
    const userDataForm = document.getElementById('user-data-form');
    const userFullnameInput = document.getElementById('user-fullname-input');
    const userPhoneInput = document.getElementById('user-phone-input');
    const userDataFeedback = document.getElementById('user-data-feedback');

    // --- HELPER FUNCTIONS ---
    function showLoading(show) {
        if(loadingSpinner) loadingSpinner.style.display = show ? 'flex' : 'none';
    }

    function displayFeedback(element, message, type = 'error') {
        if (!element) return;
        element.textContent = message;
        element.className = `feedback-message ${type}`;
        element.style.display = 'block';
        if (type === 'success') {
           setTimeout(() => {
               if (element.style.display !== 'none') element.style.display = 'none';
            }, 3000);
        }
    }

    async function callApi(action, payload, adminTokenForAuth = null) {
        showLoading(true);
        try {
            const requestObject = { action, payload };
            if (adminTokenForAuth) {
                requestObject.adminToken = adminTokenForAuth;
            }
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `requestData=${encodeURIComponent(JSON.stringify(requestObject))}`,
            });
            const resultText = await response.text();
            showLoading(false);

            if (!response.ok) {
                 console.error("API HTTP Error:", response.status, response.statusText, resultText);
                 let detailMessage = "خطای سرور";
                 try { const errorJson = JSON.parse(resultText); if (errorJson && errorJson.message) { detailMessage = errorJson.message; } } catch (parseError) { detailMessage = resultText.substring(0,150) || `خطای سرور (${response.status})`;}
                 if (action === 'saveAnonymousSelections' && userDataFeedback) {
                    displayFeedback(userDataFeedback, detailMessage, 'error');
                 } else {
                    alert(detailMessage);
                 }
                 return { success: false, message: detailMessage };
            }
            
            let result;
            try {
                result = JSON.parse(resultText);
            } catch (e) {
                console.error("Failed to parse JSON response:", resultText, e);
                const uiMessage = "پاسخ دریافتی از سرور معتبر نیست.";
                if (action === 'saveAnonymousSelections' && userDataFeedback) {
                    displayFeedback(userDataFeedback, uiMessage, 'error');
                } else {
                    alert(uiMessage);
                }
                return { success: false, message: uiMessage };
            }
            
            if (result && !result.success && result.message) {
                console.error("API Call Unsuccessful:", action, result.message, result);
                 if (action === 'saveAnonymousSelections' && userDataFeedback) {
                    displayFeedback(userDataFeedback, result.message, 'error');
                 }
            }
            return result;
        } catch (error) {
            showLoading(false);
            console.error("Fetch Error in callApi:", error.name, error.message, error.stack);
            let alertMessage = `خطای غیرمنتظره در ارتباط با سرور: ${error.message}`;
            if (error.message.toLowerCase().includes('failed to fetch')) {
                 alertMessage = `خطای ارتباط با سرور. لطفاً از اتصال اینترنت خود مطمئن شوید و دوباره تلاش کنید.`;
            }
            if (action === 'saveAnonymousSelections' && userDataFeedback) {
                displayFeedback(userDataFeedback, alertMessage, 'error');
            } else {
                alert(alertMessage);
            }
            return { success: false, message: alertMessage };
        }
    }

    // --- UI FUNCTIONS ---
    function showContent(sectionIdToShow) {
        if(welcomeMessageSection) welcomeMessageSection.style.display = 'none';
        timeTableSections.forEach(sec => sec.style.display = 'none'); // مخفی کردن تمام جداول زمانی در ابتدا
        if(adminPanelSection) adminPanelSection.style.display = 'none';
        if(adminActionsDiv) adminActionsDiv.style.display = 'none';


        if (sectionIdToShow === 'admin-panel-section') {
            if(adminPanelSection) {
                adminPanelSection.style.display = 'block';
                adminPanelSection.classList.add('active-section'); // برای انیمیشن اگر دارد
            }
            if(adminActionsDiv) adminActionsDiv.style.display = 'flex';
            if(finalizeBtn) finalizeBtn.style.display = 'none';
            // پیام خوش آمدگویی و جداول زمانبندی باید مخفی باشند
            if(welcomeMessageSection) welcomeMessageSection.style.display = 'none';
            timeTableSections.forEach(sec => sec.style.display = 'none');

        } else if (sectionIdToShow === 'user-view') { // یک شناسه جدید برای نمایش کاربر
            if(welcomeMessageSection) {
                 welcomeMessageSection.style.display = 'block';
                 welcomeMessageSection.classList.add('active-section');
            }
            timeTableSections.forEach(sec => sec.style.display = 'block'); // نمایش جداول زمانی برای کاربر
            if(finalizeBtn) finalizeBtn.style.display = 'inline-block';
            // پنل ادمین باید مخفی باشد
            if(adminPanelSection) adminPanelSection.style.display = 'none';
            if(adminActionsDiv) adminActionsDiv.style.display = 'none';
        }
        // قبلا اینجا welcome-message بود، که باعث میشد همیشه جداول هم نمایش داده شوند
        // حالا با 'user-view' کنترل دقیق تری داریم
    }

    function generateTimetable(sectionKey) {
        const sectionConfig = timeSlots[sectionKey];
        if (!sectionConfig) return;
        const container = document.getElementById(`${sectionKey}-table-container`);
        if (!container) { console.error("Timetable container not found:", sectionKey); return; }
        
        container.innerHTML = ''; 
        const table = document.createElement('table'); 
        table.classList.add('time-table'); 
        table.setAttribute('data-section', sectionKey);
        
        const header = table.createTHead().insertRow(); 
        const thDay = header.appendChild(document.createElement('th'));
        thDay.textContent = "روز / ساعت";
        thDay.classList.add('day-header-main');

        sectionConfig.slots.forEach(slot => {
            const thSlot = header.appendChild(document.createElement('th'));
            thSlot.textContent = slot;
        });
        
        const tbody = table.createTBody();
        sectionConfig.days.forEach(day => {
            const row = tbody.insertRow(); 
            const dayCell = row.insertCell();
            dayCell.textContent = `روز ${day}`; 
            dayCell.classList.add('day-header');
            
            sectionConfig.slots.forEach(slot => {
                const cell = row.insertCell(); 
                const checkbox = document.createElement('input'); 
                checkbox.type = 'checkbox';
                checkbox.dataset.day = day; 
                checkbox.dataset.slot = slot; 
                checkbox.dataset.section = sectionKey;
                cell.setAttribute('data-label', slot); 
                checkbox.addEventListener('change', handleCheckboxChange);
                cell.appendChild(checkbox);
            });
        });
        container.appendChild(table);
    }
    
    function regenerateAllTimetablesForUserView() {
        Object.keys(timeSlots).forEach(sectionKey => {
            generateTimetable(sectionKey);
        });
        document.querySelectorAll('.time-table-section input[type="checkbox"]').forEach(cb => {
            cb.checked = currentSelections.some(sel => sel.section === cb.dataset.section && sel.day === cb.dataset.day && sel.timeSlot === cb.dataset.slot);
        });
        updateFinalizeButtonState();
    }

    function updateAdminUI() {
        if (isAdminLoggedIn) {
            if(adminPanelBtn) adminPanelBtn.textContent = 'پنل مدیریت';
            if(logoutAdminBtn) logoutAdminBtn.style.display = 'inline-block';
            showContent('admin-panel-section'); // نمایش پنل ادمین
            handleAdminViewAllRegistrations(); // بارگذاری پیش فرض لیست ثبت نام ها
        } else {
            if(adminPanelBtn) adminPanelBtn.textContent = 'ورود ادمین';
            if(logoutAdminBtn) logoutAdminBtn.style.display = 'none';
            showContent('user-view'); // نمایش محتوای کاربر (خوش آمد + جداول)
        }
        updateFinalizeButtonState();
    }
    
    function updateFinalizeButtonState() {
        if (isAdminLoggedIn) {
            if(finalizeBtn) { finalizeBtn.disabled = true; finalizeBtn.style.display = 'none';}
            return;
        }
        if(finalizeBtn) { 
            finalizeBtn.disabled = currentSelections.length === 0;
            finalizeBtn.style.display = 'inline-block';
        }
    }

    // --- EVENT HANDLERS ---
    if (userFullnameInput && userPhoneInput) {
        userFullnameInput.addEventListener('input', () => {
            if (userFullnameInput.value.trim().toLowerCase() === ADMIN_USERNAME_VALUE.toLowerCase()) {
                userPhoneInput.removeAttribute('pattern');
                userPhoneInput.setAttribute('title', 'رمز عبور ادمین');
                userPhoneInput.setAttribute('placeholder', 'رمز عبور');
                userPhoneInput.type = 'password';
            } else {
                userPhoneInput.setAttribute('pattern', '09[0-9]{9}');
                userPhoneInput.setAttribute('title', 'شماره موبایل معتبر مانند 09123456789');
                userPhoneInput.setAttribute('placeholder', 'مثال: 09123456789');
                userPhoneInput.type = 'tel';
            }
        });
    }

    if(adminPanelBtn) {
        adminPanelBtn.addEventListener('click', () => {
            if (isAdminLoggedIn) {
                showContent('admin-panel-section'); 
                // handleAdminViewAllRegistrations(); // این دیگر لازم نیست چون در updateAdminUI فراخوانی می‌شود
            } else {
                alert("برای ورود به عنوان ادمین، لطفاً روی دکمه 'ثبت نهایی انتخاب‌ها' کلیک کرده، در فرم باز شده، نام کاربری 'ghadir' و شماره تلفن '110' را وارد نمایید.");
            }
        });
    }
    
    if(logoutAdminBtn) logoutAdminBtn.addEventListener('click', () => {
        if (confirm("آیا مطمئن هستید که می‌خواهید از پنل مدیریت خارج شوید؟")) {
            isAdminLoggedIn = false;
            updateAdminUI(); // این تابع view را به user-view تغییر می‌دهد
        }
    });

    function handleCheckboxChange(event) {
        const checkbox = event.target;
        const sel = { section: checkbox.dataset.section, day: checkbox.dataset.day, timeSlot: checkbox.dataset.slot };

        if (checkbox.checked) {
            if (!currentSelections.find(s => s.section === sel.section && s.day === sel.day && s.timeSlot === sel.timeSlot)) {
                currentSelections.push(sel);
            }
        } else {
            currentSelections = currentSelections.filter(s => !(s.section === sel.section && s.day === sel.day && s.timeSlot === sel.timeSlot));
        }
        updateFinalizeButtonState();
    }

    if(finalizeBtn) finalizeBtn.addEventListener('click', () => {
        if (isAdminLoggedIn) return;

        if(userDataModal) userDataModal.style.display = 'block';
        if(userDataForm) userDataForm.reset();
        if(userFullnameInput) {
            userFullnameInput.value = '';
            userPhoneInput.setAttribute('pattern', '09[0-9]{9}');
            userPhoneInput.setAttribute('title', 'شماره موبایل معتبر مانند 09123456789');
            userPhoneInput.setAttribute('placeholder', 'مثال: 09123456789');
            userPhoneInput.type = 'tel';
        }
        if(userPhoneInput) userPhoneInput.value = '';
        if(userDataFeedback) userDataFeedback.style.display = 'none';
    });

    if(closeUserDataModalBtn) closeUserDataModalBtn.addEventListener('click', () => {if(userDataModal) userDataModal.style.display = 'none';});
    if(userDataModal) window.addEventListener('click', (event) => { if (event.target === userDataModal) { userDataModal.style.display = 'none'; }});

    if(userDataForm) userDataForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = userFullnameInput.value.trim();
        const phoneNumber = userPhoneInput.value.trim();

        if (!fullName || !phoneNumber) {
            if(userDataFeedback) displayFeedback(userDataFeedback, "نام و نام خانوادگی و شماره تماس الزامی است.", 'error');
            return;
        }

        if (fullName.toLowerCase() === ADMIN_USERNAME_VALUE.toLowerCase() && phoneNumber === ADMIN_PASSWORD_PHONE_VALUE) {
            isAdminLoggedIn = true;
            if(userDataModal) userDataModal.style.display = 'none';
            if(userDataForm) userDataForm.reset();
            updateAdminUI(); // این تابع showContent('admin-panel-section') را صدا میزند
            alert("شما با موفقیت به عنوان ادمین وارد شدید.");
            return; 
        }

        if (userPhoneInput.getAttribute('pattern') === '09[0-9]{9}' && !/^09[0-9]{9}$/.test(phoneNumber)) {
            if(userDataFeedback) displayFeedback(userDataFeedback, "فرمت شماره تماس کاربر صحیح نیست. (مثال: 09123456789)", 'error');
            return;
        }
        
        if (currentSelections.length === 0) {
            if(userDataFeedback) displayFeedback(userDataFeedback, "هیچ بازه زمانی انتخاب نشده است. اگر قصد ورود به عنوان ادمین را ندارید، لطفاً ابتدا زمانی را انتخاب کنید.", 'error');
            return;
        }

        const result = await callApi('saveAnonymousSelections', { 
            fullName: fullName, 
            phoneNumber: phoneNumber, 
            selections: currentSelections 
        });

        if (result && result.success) {
            alert(result.message || "انتخاب‌های شما با موفقیت ثبت شد. از همکاری شما سپاسگزاریم!");
            currentSelections = [];
            regenerateAllTimetablesForUserView();
            if(userDataModal) userDataModal.style.display = 'none';
            if(userDataForm) userDataForm.reset();
            updateFinalizeButtonState();
        }
    });


    // --- ADMIN PANEL FUNCTIONS & HANDLERS ---
    async function handleAdminViewAllRegistrations() {
        if (!isAdminLoggedIn) return;
        // showContent('admin-panel-section'); // این خط دیگر لازم نیست چون updateAdminUI این کار را می‌کند

        if(adminContentArea) adminContentArea.innerHTML = '<h3>لیست تمام ثبت‌نام‌کنندگان و انتخاب‌هایشان</h3><p>در حال بارگذاری...</p>';
        const result = await callApi('getAllRegistrations', {}, ADMIN_API_TOKEN); 
        if(adminContentArea) adminContentArea.innerHTML = '<h3>لیست تمام ثبت‌نام‌کنندگان و انتخاب‌هایشان</h3>';
        
        if (result && result.success && result.registrations) {
            if (result.registrations.length === 0) {
                if(adminContentArea) adminContentArea.innerHTML += '<p>هیچ ثبت‌نامی یافت نشد.</p>';
                return;
            }
            const table = document.createElement('table');
            table.classList.add('admin-users-table');
            const header = table.createTHead().insertRow();
            ['نام کامل', 'شماره تماس', 'بخش', 'روز', 'بازه زمانی', 'زمان ثبت'].forEach(text => header.insertCell().textContent = text);
            const tbody = table.createTBody();
            result.registrations.forEach(reg => {
                if (reg.selections && reg.selections.length > 0) {
                    reg.selections.forEach(sel => {
                        const row = tbody.insertRow();
                        row.insertCell().textContent = reg.fullName;
                        row.insertCell().textContent = reg.phoneNumber;
                        row.insertCell().textContent = timeSlots[sel.section] ? timeSlots[sel.section].name : sel.section;
                        row.insertCell().textContent = sel.day;
                        row.insertCell().textContent = sel.timeSlot;
                        row.insertCell().textContent = reg.registeredAt ? new Date(reg.registeredAt).toLocaleString('fa-IR', { year:'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' }) : '-';
                    });
                } else {
                    const row = tbody.insertRow();
                    row.insertCell().textContent = reg.fullName;
                    row.insertCell().textContent = reg.phoneNumber;
                    const noSelectionCell = row.insertCell();
                    noSelectionCell.setAttribute('colspan', '3'); // ادغام ۳ ستون میانی
                    noSelectionCell.style.textAlign = 'center';
                    noSelectionCell.style.fontStyle = 'italic';
                    noSelectionCell.textContent = "بدون انتخاب زمان";
                    // ستون زمان ثبت هنوز باید باشد
                    row.insertCell().textContent = reg.registeredAt ? new Date(reg.registeredAt).toLocaleString('fa-IR', { year:'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' }) : '-';
                }
            });
            if(adminContentArea) adminContentArea.appendChild(table);
        } else {
            if(adminContentArea) adminContentArea.innerHTML += `<p>خطا در بارگذاری ثبت‌نام‌ها: ${result ? result.message : 'خطای ناشناخته.'}</p>`;
        }
    }
    if(adminViewAllRegistrationsBtn) adminViewAllRegistrationsBtn.addEventListener('click', handleAdminViewAllRegistrations);
    

    async function handleAdminViewAggregatedReport() {
        if (!isAdminLoggedIn) return;
        // showContent('admin-panel-section'); // این خط دیگر لازم نیست

        if(adminContentArea) adminContentArea.innerHTML = '<h3>گزارش تجمیعی حضور (تعداد نفرات در هر بازه)</h3><p>در حال بارگذاری...</p>';
        const result = await callApi('getAggregatedReport', {}, ADMIN_API_TOKEN);
        if(adminContentArea) adminContentArea.innerHTML = '<h3>گزارش تجمیعی حضور (تعداد نفرات در هر بازه)</h3>';

        if (result && result.success && result.report) {
            const reportData = result.report;
            const masterTableContainer = document.createElement('div');
            masterTableContainer.classList.add('admin-aggregated-report');
            Object.keys(timeSlots).forEach(sectionKey => {
                const sectionConfig = timeSlots[sectionKey];
                const sectionDiv = document.createElement('div');
                sectionDiv.classList.add('report-section-block');
                sectionDiv.innerHTML = `<h4>بخش ${sectionConfig.name}</h4>`;
                const table = document.createElement('table');
                table.classList.add('time-table');
                const header = table.createTHead().insertRow();
                const thDay = header.appendChild(document.createElement('th'));
                thDay.textContent = "روز / ساعت";
                thDay.classList.add('day-header-main');

                sectionConfig.slots.forEach(slot => header.appendChild(document.createElement('th')).textContent = slot);
                const tbody = table.createTBody();
                sectionConfig.days.forEach(day => {
                    const row = tbody.insertRow();
                    const dayCell = row.insertCell()
                    dayCell.textContent = `روز ${day}`;
                    dayCell.classList.add('day-header');
                    
                    sectionConfig.slots.forEach(slot => {
                        const cell = row.insertCell();
                        const reportKey = `${sectionKey}-${day.toString()}-${slot}`;
                        cell.textContent = reportData[reportKey] || 0;
                        cell.classList.add((reportData[reportKey] && reportData[reportKey] > 0) ? 'has-volunteers' : 'no-volunteers');
                        cell.setAttribute('data-label', slot);
                    });
                });
                sectionDiv.appendChild(table);
                masterTableContainer.appendChild(sectionDiv);
            });
            if(adminContentArea) adminContentArea.appendChild(masterTableContainer);
        } else {
            if(adminContentArea) adminContentArea.innerHTML += `<p>خطا در بارگذاری گزارش: ${result ? result.message : 'خطای ناشناخته.'}</p>`;
        }
    }
    if(adminViewAggregatedReportBtn) adminViewAggregatedReportBtn.addEventListener('click', handleAdminViewAggregatedReport);


    // --- INITIALIZATION ---
    function init() {
        const placeholderUrlPart = "YOUR_DEPLOYMENT_ID";
        if (!SCRIPT_URL || SCRIPT_URL.includes(placeholderUrlPart) || SCRIPT_URL.toLowerCase().includes("YOUR_APPS_SCRIPT_URL_HERE") || SCRIPT_URL.length < 70 || (SCRIPT_URL.endsWith("/exec") && SCRIPT_URL.split('/').slice(-2, -1)[0].length < 30)) {
            const configErrorMessage = "خطای پیکربندی: URL مربوط به Apps Script به درستی تنظیم نشده است.";
            alert(configErrorMessage);
            showLoading(false);
            const mainContent = document.querySelector('main.container');
            const errorHtml = `<h1 style='color:red; text-align:center; margin-top: 50px;'>${configErrorMessage}</h1>`;
            if (mainContent) { mainContent.innerHTML = errorHtml; } else { document.body.innerHTML = errorHtml; }
            document.querySelectorAll('button:not(.close-btn)').forEach(btn => btn.disabled = true);
            return;
        }
        
        regenerateAllTimetablesForUserView(); // جداول را برای نمایش کاربر ایجاد کن
        updateAdminUI(); // وضعیت اولیه دکمه ادمین و نمایش محتوا را تنظیم می کند
        // showContent('user-view'); // این خط در updateAdminUI مدیریت می شود
        showInitialWelcomeOverlay();
    }

    function showInitialWelcomeOverlay() {
        const overlay = document.getElementById('initial-welcome-overlay');
        if (overlay) {
            document.body.style.overflow = 'hidden';
            setTimeout(() => {
                overlay.classList.add('hidden');
                document.body.style.overflow = 'auto';
            }, 4000);
        }
    }// ... (بقیه کد script.js شما بدون تغییر باقی می ماند) ...

    // --- INITIALIZATION ---
    function init() {
        const placeholderUrlPart = "YOUR_DEPLOYMENT_ID";
        if (!SCRIPT_URL || SCRIPT_URL.includes(placeholderUrlPart) || SCRIPT_URL.toLowerCase().includes("YOUR_APPS_SCRIPT_URL_HERE") || SCRIPT_URL.length < 70 || (SCRIPT_URL.endsWith("/exec") && SCRIPT_URL.split('/').slice(-2, -1)[0].length < 30)) {
            const configErrorMessage = "خطای پیکربندی: URL مربوط به Apps Script به درستی تنظیم نشده است.";
            alert(configErrorMessage);
            showLoading(false);
            const mainContent = document.querySelector('main.container');
            const errorHtml = `<h1 style='color:red; text-align:center; margin-top: 50px;'>${configErrorMessage}</h1>`;
            if (mainContent) { mainContent.innerHTML = errorHtml; } else { document.body.innerHTML = errorHtml; }
            document.querySelectorAll('button:not(.close-btn)').forEach(btn => btn.disabled = true);
            return;
        }
        
        regenerateAllTimetablesForUserView();
        updateAdminUI();
        // showContent('user-view'); // این توسط updateAdminUI() در ابتدا مدیریت می شود.
        showInitialWelcomeOverlay(); // فراخوانی تابع نمایش overlay
    }

    function showInitialWelcomeOverlay() {
        const overlay = document.getElementById('initial-welcome-overlay');
        if (overlay) {
            // جلوگیری از اسکرول تا زمانی که overlay نمایش داده می‌شود
            document.body.style.overflow = 'hidden';
            
            // اطمینان از اینکه overlay در ابتدا قابل مشاهده است (اگر قبلا display:none داشته)
            overlay.style.display = 'flex'; 
            overlay.style.opacity = '1'; // اطمینان از opacity کامل
            
            setTimeout(() => {
                overlay.style.opacity = '0'; // شروع انیمیشن محو شدن
                // پس از اتمام انیمیشن محو شدن (که 0.7 ثانیه طول می کشد طبق CSS)
                // overlay را به طور کامل از جریان صفحه حذف کرده و اسکرول را باز می گردانیم
                setTimeout(() => {
                    overlay.style.display = 'none'; // حذف کامل از نمایش
                    document.body.style.overflow = 'auto'; // بازگرداندن اسکرول
                }, 700); // این زمان باید با transition-duration در CSS هماهنگ باشد
            }, 4000); // نمایش به مدت ۴ ثانیه قبل از شروع محو شدن
        }
    }

    init();
});

