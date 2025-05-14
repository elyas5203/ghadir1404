document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    // !!! این URL را با URL دیپلوی شده خودتان از Apps Script جایگزین کنید !!!
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxVVyioorf65Pmi4qHNgI2maUUukWYyJ7fLGhv_4d0ZmvlqYJwwmadD9cwghPATrvBR/exec"; // مثال، حتما جایگزین شود
    const ADMIN_TOKEN = "ADMIN_SECRET_TOKEN_110";

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
    let currentUser = null;
    let currentSelections = [];
    let previousUserSelections = [];
    let selectingForUserByAdmin = null;

    // --- DOM ELEMENTS ---
    const sectionNavButtons = document.querySelectorAll('#section-nav .nav-btn');
    const sectionNav = document.getElementById('section-nav');
    const contentSections = document.querySelectorAll('.content-section');
    const welcomeMessageSection = document.getElementById('welcome-message');
    const loginRegisterBtn = document.getElementById('login-register-btn');
    const finalizeBtn = document.getElementById('finalize-btn');
    const userInfoDisplay = document.getElementById('user-info');
    const userFullnameSpan = document.getElementById('user-fullname-display');
    const logoutBtn = document.getElementById('logout-btn');
    const adminPanelBtn = document.getElementById('admin-panel-btn');
    const authModal = document.getElementById('auth-modal');
    const closeModalBtn = authModal.querySelector('.close-btn');
    const loginFormContainer = document.getElementById('login-form-container');
    const registerFormContainer = document.getElementById('register-form-container');
    const adminAddUserFormContainer = document.getElementById('admin-add-user-form-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const adminAddUserForm = document.getElementById('admin-add-user-form');
    const showRegisterLink = document.getElementById('show-register-link');
    const showLoginLink = document.getElementById('show-login-link');
    const regUsernameInput = document.getElementById('reg-username');
    const usernameFeedbackDiv = document.getElementById('username-feedback');
    const loadingSpinner = document.getElementById('loading-spinner');
    const adminPanelSection = document.getElementById('admin-panel-section');
    const adminActionsDiv = document.querySelector('#admin-panel-section .admin-actions');
    const adminAddUserBtn = document.getElementById('admin-add-user-btn');
    const adminViewAllUsersBtn = document.getElementById('admin-view-all-users-btn');
    const adminViewAggregatedReportBtn = document.getElementById('admin-view-aggregated-report-btn');
    const adminContentArea = document.getElementById('admin-content-area');

    // --- HELPER FUNCTIONS ---
    function showLoading(show) {
        if(loadingSpinner) loadingSpinner.style.display = show ? 'flex' : 'none';
    }

    function displayFeedback(element, message, type = 'error') {
        if (!element) return;
        element.textContent = message;
        element.className = `feedback-message ${type}`;
        element.style.display = 'block';
        if (type !== 'error' || element.id === 'username-feedback') {
           setTimeout(() => {
               if (element.textContent === message && element.style.display !== 'none') {
                   element.style.display = 'none';
               }
            }, type === 'success' ? 3000 : 5000);
        }
    }

    async function callApi(action, payload, isAdminRequest = false) {
        showLoading(true);
        try {
            const requestObject = { action, payload };
            if (isAdminRequest && currentUser && currentUser.isAdmin) {
                requestObject.adminToken = ADMIN_TOKEN;
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
            if (!response.ok) {
                 const errorText = await response.text();
                 console.error("API HTTP Error:", response.status, response.statusText, errorText);
                 let detailMessage = errorText;
                 try { const errorJson = JSON.parse(errorText); if (errorJson && errorJson.message) { detailMessage = errorJson.message; } } catch (parseError) {}
                 showLoading(false);
                 alert(`خطای سرور (${response.status}): ${detailMessage}`);
                 return { success: false, message: `خطای سرور (${response.status}): ${detailMessage}` };
            }
            const resultText = await response.text();
            let result;
            try {
                result = JSON.parse(resultText);
            } catch (e) {
                console.error("Failed to parse JSON response:", resultText, e);
                showLoading(false);
                const uiMessage = "پاسخ دریافتی از سرور معتبر نیست. متن: " + resultText.substring(0,100) + "...";
                alert(uiMessage);
                return { success: false, message: uiMessage };
            }
            showLoading(false);
            if (result && !result.success) {
                console.error("API Call Unsuccessful:", action, result.message, result);
            }
            return result;
        } catch (error) {
            showLoading(false);
            console.error("Fetch Error in callApi:", error.name, error.message, error.stack);
            let alertMessage = `خطای غیرمنتظره: ${error.message}`;
            if (error.message.toLowerCase().includes('failed to fetch')) {
                 alertMessage = `خطای ارتباط با سرور. لطفاً از اتصال اینترنت خود مطمئن شوید و دوباره تلاش کنید.`;
            }
            alert(alertMessage);
            return { success: false, message: error.message };
        }
    }

    // --- UI FUNCTIONS ---
    function showSection(sectionIdToShow) {
        contentSections.forEach(section => {
            section.classList.remove('active-section');
            section.style.display = 'none';
        });
        if(adminPanelSection) adminPanelSection.style.display = 'none';

        if (sectionIdToShow === 'admin-panel-section') {
            if(sectionNav) sectionNav.style.display = 'none';
            if(finalizeBtn) finalizeBtn.style.display = 'none';
            if(adminPanelSection) adminPanelSection.style.display = 'block';
            if(adminActionsDiv) adminActionsDiv.style.display = 'flex'; // Ensure admin actions are visible
        } else {
            if(sectionNav) sectionNav.style.display = 'flex';
            if (currentUser && !currentUser.isAdmin) { // Only show finalize for logged-in non-admin users
                 if(finalizeBtn) finalizeBtn.style.display = 'inline-block';
            } else {
                 if(finalizeBtn) finalizeBtn.style.display = 'none';
            }
            const sectionElement = document.getElementById(sectionIdToShow);
            if (sectionElement) {
                sectionElement.classList.add('active-section');
                sectionElement.style.display = 'block';
            } else {
                if(welcomeMessageSection) {
                    welcomeMessageSection.classList.add('active-section');
                    welcomeMessageSection.style.display = 'block';
                }
            }
        }
    }

    function generateTimetable(sectionKey, targetContainerId = null, pUserSelections = null) {
        const sectionConfig = timeSlots[sectionKey];
        if (!sectionConfig) return;
        const container = targetContainerId ? document.getElementById(targetContainerId) : document.getElementById(`${sectionKey}-table-container`);
        if (!container) { console.error("Timetable container not found:", sectionKey, targetContainerId); return; }
        container.innerHTML = ''; const table = document.createElement('table'); table.classList.add('time-table'); table.setAttribute('data-section', sectionKey);
        const header = table.createTHead().insertRow(); header.insertCell().textContent = "روز / ساعت";
        sectionConfig.slots.forEach(slot => header.appendChild(document.createElement('th')).textContent = slot);
        const tbody = table.createTBody();
        sectionConfig.days.forEach(day => {
            const row = tbody.insertRow(); row.insertCell().textContent = `روز ${day}`; row.cells[0].classList.add('day-header');
            sectionConfig.slots.forEach(slot => {
                const cell = row.insertCell(); const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
                checkbox.dataset.day = day; checkbox.dataset.slot = slot; checkbox.dataset.section = sectionKey;
                const relevantPreviousSelections = pUserSelections !== null ? pUserSelections : previousUserSelections;
                const isPreviouslySelected = relevantPreviousSelections.some(ps => ps.section === sectionKey && ps.day === day && ps.timeSlot === slot);
                if (isPreviouslySelected) {
                    checkbox.checked = true;
                    if (!selectingForUserByAdmin && !targetContainerId?.includes('-admin-edit-')) { checkbox.disabled = true; cell.classList.add('selected-previously');}
                    else if (targetContainerId?.includes('-admin-edit-')) { cell.classList.add('selected-previously-admin-view'); }
                }
                const isForAdminEdit = targetContainerId?.includes('-admin-edit-') || selectingForUserByAdmin;
                checkbox.addEventListener('change', isForAdminEdit ? handleCheckboxChangeForAdminEdit : handleCheckboxChange);
                cell.appendChild(checkbox);
            });
        });
        container.appendChild(table);
    }
    
    function regenerateAllTimetables(forAdminEditContext = false, specificUserSelections = null) {
        Object.keys(timeSlots).forEach(sectionKey => {
            if (forAdminEditContext && selectingForUserByAdmin && selectingForUserByAdmin.userId) {
                const containerId = `${sectionKey}-table-container-admin-edit-${selectingForUserByAdmin.userId}`;
                if (document.getElementById(containerId)) { // Check if container exists before generating
                    generateTimetable(sectionKey, containerId, specificUserSelections || []);
                }
            } else if (!forAdminEditContext) {
                generateTimetable(sectionKey, null, previousUserSelections);
            }
        });
        const activeCheckboxesSelector = selectingForUserByAdmin ? `#admin-content-area input[type="checkbox"]` : `.time-table-section input[type="checkbox"]:not([disabled])`;
        document.querySelectorAll(activeCheckboxesSelector).forEach(cb => {
            cb.checked = currentSelections.some(sel => sel.section === cb.dataset.section && sel.day === cb.dataset.day && sel.timeSlot === cb.dataset.slot);
        });
        if (!selectingForUserByAdmin) { updateFinalizeButtonState(); }
        else {
            const finalizeBtnAdmin = document.getElementById('finalize-selections-for-user-by-admin-btn');
            if (finalizeBtnAdmin) {
                const hadPrevious = specificUserSelections && specificUserSelections.length > 0;
                // Enable button if there are current selections, or if there were previous and now none (to allow saving "delete all")
                finalizeBtnAdmin.disabled = !(currentSelections.length > 0 || (currentSelections.length === 0 && hadPrevious));
            }
        }
    }

    function updateUIForLoginState() {
        if (currentUser) {
            if(loginRegisterBtn) loginRegisterBtn.style.display = 'none';
            if(userInfoDisplay) userInfoDisplay.style.display = 'flex';
            if(userFullnameSpan) userFullnameSpan.textContent = `سلام ${currentUser.fullName}`;
            
            const isAdminViewingAdminPanel = currentUser.isAdmin && adminPanelSection && (adminPanelSection.style.display === 'block' || adminPanelSection.classList.contains('active-section'));

            if (currentUser.isAdmin) {
                if(adminPanelBtn) adminPanelBtn.style.display = 'inline-block';
                if(finalizeBtn) finalizeBtn.style.display = 'none'; // Admin doesn't use user's finalize button
            } else {
                if(adminPanelBtn) adminPanelBtn.style.display = 'none';
                if(finalizeBtn && !isAdminViewingAdminPanel) finalizeBtn.style.display = 'inline-block'; else if(finalizeBtn) finalizeBtn.style.display = 'none';
            }
            fetchUserPreviousSelections(); // This will also call regenerateAllTimetables and updateFinalizeButtonState
        } else { // Logged out state
            if(loginRegisterBtn) loginRegisterBtn.style.display = 'inline-block';
            if(userInfoDisplay) userInfoDisplay.style.display = 'none';
            if(userFullnameSpan) userFullnameSpan.textContent = '';
            if(finalizeBtn) finalizeBtn.style.display = 'none';
            if(adminPanelBtn) adminPanelBtn.style.display = 'none';
            previousUserSelections = [];
            currentSelections = [];
            if(sectionNav) sectionNav.style.display = 'flex';
            regenerateAllTimetables();
        }
        updateFinalizeButtonState();
    }

    function getNewSelections() { return currentSelections.filter(cs => !previousUserSelections.some(ps => ps.section === cs.section && ps.day === cs.day && ps.timeSlot === cs.timeSlot));}
    
    function updateFinalizeButtonState() {
        if (!currentUser || currentUser.isAdmin || selectingForUserByAdmin || (adminPanelSection && (adminPanelSection.style.display === 'block' || adminPanelSection.style.display === ''))) {
            if(finalizeBtn) { finalizeBtn.disabled = true; finalizeBtn.style.display = 'none';}
            return;
        }
        if(finalizeBtn) { finalizeBtn.style.display = 'inline-block'; finalizeBtn.disabled = getNewSelections().length === 0;}
    }

    // --- EVENT HANDLERS ---
    sectionNavButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (selectingForUserByAdmin) {
                if (!confirm("شما در حال انتخاب زمان برای یک کاربر هستید. آیا می‌خواهید این صفحه را ترک کنید؟ تغییرات ذخیره نشده از بین خواهند رفت.")) return;
                selectingForUserByAdmin = null; currentSelections = []; showSection('admin-panel-section'); handleAdminViewAllUsers(); return;
            }
            const sectionId = button.dataset.section + '-section'; showSection(sectionId); updateFinalizeButtonState();
        });
    });

    if(loginRegisterBtn) loginRegisterBtn.addEventListener('click', () => {
        if(authModal) authModal.style.display = 'block';
        if(loginFormContainer) loginFormContainer.style.display = 'block';
        if(registerFormContainer) registerFormContainer.style.display = 'none';
        if(adminAddUserFormContainer) adminAddUserFormContainer.style.display = 'none';
        if(loginForm) loginForm.reset();
        if(registerForm) registerForm.reset();
        if(authModal) authModal.querySelectorAll('.feedback-message').forEach(el => el.style.display = 'none');
    });

    if(closeModalBtn) closeModalBtn.addEventListener('click', () => { if(authModal) authModal.style.display = 'none'; });
    window.addEventListener('click', (event) => { if (event.target === authModal) { if(authModal) authModal.style.display = 'none'; }});

    if(showRegisterLink) showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        if(loginFormContainer) loginFormContainer.style.display = 'none';
        if(registerFormContainer) registerFormContainer.style.display = 'block';
        if(adminAddUserFormContainer) adminAddUserFormContainer.style.display = 'none';
        if(registerForm) registerForm.reset();
        if(authModal) authModal.querySelectorAll('.feedback-message').forEach(el => el.style.display = 'none');
    });

    if(showLoginLink) showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        if(registerFormContainer) registerFormContainer.style.display = 'none';
        if(loginFormContainer) loginFormContainer.style.display = 'block';
        if(adminAddUserFormContainer) adminAddUserFormContainer.style.display = 'none';
        if(loginForm) loginForm.reset();
        if(authModal) authModal.querySelectorAll('.feedback-message').forEach(el => el.style.display = 'none');
    });

    if(regUsernameInput) regUsernameInput.addEventListener('input', async () => {
        const username = regUsernameInput.value.trim();
        if(usernameFeedbackDiv) usernameFeedbackDiv.style.display = 'none';
        if (username.length > 2) {
            const result = await callApi('checkUsername', { username });
            if (result && result.success !== undefined) {
                 if(usernameFeedbackDiv) displayFeedback(usernameFeedbackDiv, result.message, result.available ? 'success' : 'error');
            } else {
                if(usernameFeedbackDiv) displayFeedback(usernameFeedbackDiv, result ? result.message : "خطا در بررسی نام کاربری.", 'error');
            }
        }
    });

    if(loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginForm['login-username'].value;
        const password = loginForm['login-password'].value;
        const feedbackElement = loginForm.querySelector('.feedback-message');
        if(feedbackElement) feedbackElement.style.display = 'none';

        const result = await callApi('loginUser', { username, password });
        if (result && result.success && result.user) {
            currentUser = result.user;
            updateUIForLoginState();
            if(authModal) authModal.style.display = 'none';
            alert(`کاربر ${currentUser.fullName} با موفقیت وارد شدید.`);
            if (currentUser.isAdmin) {
                showSection('admin-panel-section');
                handleAdminViewAllUsers();
            } else {
                showSection('welcome-message');
            }
        } else {
            if(feedbackElement) displayFeedback(feedbackElement, result ? result.message : "ورود ناموفق. خطای نامشخص.", 'error');
        }
    });

    if(registerForm) registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = registerForm['reg-fullname'].value;
        const phoneNumber = registerForm['reg-phone'].value;
        const username = registerForm['reg-username'].value;
        const password = registerForm['reg-password'].value;
        const feedbackElement = registerForm.querySelector('.feedback-message:not(#username-feedback)');
        if(feedbackElement) feedbackElement.style.display = 'none';

        if (!fullName || !phoneNumber || !username || !password) { if(feedbackElement) displayFeedback(feedbackElement, "لطفاً تمام فیلدهای ستاره‌دار را پر کنید.", 'error'); return; }
        if (!/^09[0-9]{9}$/.test(phoneNumber)) { if(feedbackElement) displayFeedback(feedbackElement, "شماره تماس معتبر نیست. (مثال: 09123456789)", 'error'); return; }
        if (password.length < 3) { if(feedbackElement) displayFeedback(feedbackElement, "رمز عبور باید حداقل ۳ کاراکتر باشد.", 'error'); return; }

        const result = await callApi('registerUser', { fullName, phoneNumber, username, password });
        if (result && result.success && result.user) {
            currentUser = result.user;
            updateUIForLoginState();
            if(authModal) authModal.style.display = 'none';
            alert(`ثبت نام ${currentUser.fullName} موفق بود. شما اکنون وارد شده‌اید.`);
            showSection('welcome-message');
        } else {
             if(feedbackElement) displayFeedback(feedbackElement, result ? result.message : "ثبت نام ناموفق. خطای نامشخص.", 'error');
        }
    });

    if(logoutBtn) logoutBtn.addEventListener('click', () => {
        currentUser = null;
        selectingForUserByAdmin = null;
        currentSelections = [];
        previousUserSelections = [];
        updateUIForLoginState();
        showSection('welcome-message');
        alert("شما با موفقیت خارج شدید.");
    });

    function handleCheckboxChange(event) {
        const checkbox = event.target;
        const sel = { section: checkbox.dataset.section, day: checkbox.dataset.day, timeSlot: checkbox.dataset.slot };

        if (checkbox.checked) {
            if (!currentSelections.find(s => s.section === sel.section && s.day === sel.day && s.timeSlot === sel.timeSlot)) {
                currentSelections.push(sel);
            }
        } else {
            if (!checkbox.disabled) {
                currentSelections = currentSelections.filter(s => !(s.section === sel.section && s.day === sel.day && s.timeSlot === sel.timeSlot));
            } else {
                checkbox.checked = true;
                alert("شما قبلاً برای این زمان اعلام آمادگی کرده‌اید و نمی‌توانید آن را لغو کنید.");
            }
        }
        updateFinalizeButtonState();
    }

    if(finalizeBtn) finalizeBtn.addEventListener('click', async () => {
        if (!currentUser) { alert("لطفاً ابتدا وارد شوید یا ثبت نام کنید."); if(loginRegisterBtn) loginRegisterBtn.click(); return; }
        if (selectingForUserByAdmin || currentUser.isAdmin) return;

        const newSelectionsToSave = getNewSelections();
        if (newSelectionsToSave.length === 0) { alert("شما زمان جدیدی را انتخاب نکرده‌اید یا تمام انتخاب‌های شما قبلاً ثبت شده‌اند."); return; }

        const result = await callApi('saveSelections', { userId: currentUser.userId, selections: newSelectionsToSave });
        if (result && result.success) {
            alert(result.message || "انتخاب‌های جدید شما با موفقیت ذخیره شد.");
            fetchUserPreviousSelections();
        } else {
            alert(`خطا در ذخیره‌سازی: ${result ? result.message : 'خطای ناشناخته در ذخیره سازی.'}`);
        }
    });

    async function fetchUserPreviousSelections() {
        if (!currentUser || selectingForUserByAdmin) return;
        const result = await callApi('getUserSelections', { userId: currentUser.userId });
        if (result && result.success && result.selections) {
            previousUserSelections = result.selections;
        } else {
            previousUserSelections = [];
            console.error("Failed to fetch user selections:", result ? result.message : "Unknown error");
        }
        currentSelections = [];
        regenerateAllTimetables();
        updateFinalizeButtonState();
    }

    // --- ADMIN PANEL FUNCTIONS & HANDLERS ---
    if(adminPanelBtn) adminPanelBtn.addEventListener('click', () => {
        if (currentUser && currentUser.isAdmin) {
            if (selectingForUserByAdmin) {
                 if (confirm("شما در حال انتخاب زمان برای یک کاربر هستید. آیا می‌خواهید به صفحه اصلی پنل ادمین بازگردید؟ تغییرات ذخیره نشده از بین خواهند رفت.")) {
                    selectingForUserByAdmin = null;
                    currentSelections = [];
                    showSection('admin-panel-section');
                    handleAdminViewAllUsers();
                }
            } else {
                showSection('admin-panel-section');
                handleAdminViewAllUsers();
            }
        } else {
            alert("شما دسترسی ادمین ندارید.");
        }
    });

    if(adminAddUserBtn) adminAddUserBtn.addEventListener('click', () => {
        if(authModal) authModal.style.display = 'block';
        if(loginFormContainer) loginFormContainer.style.display = 'none';
        if(registerFormContainer) registerFormContainer.style.display = 'none';
        if(adminAddUserFormContainer) adminAddUserFormContainer.style.display = 'block';
        if(adminAddUserForm) adminAddUserForm.reset();
        if(authModal) authModal.querySelectorAll('.feedback-message').forEach(el => el.style.display = 'none');
    });

    if(adminAddUserForm) adminAddUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser || !currentUser.isAdmin) { alert("عملیات مجاز نیست."); return; }
        const fullName = adminAddUserForm['admin-reg-fullname'].value;
        const phoneNumber = adminAddUserForm['admin-reg-phone'].value;
        const username = adminAddUserForm['admin-reg-username'].value;
        const password = adminAddUserForm['admin-reg-password'].value;
        const feedbackElement = adminAddUserForm.querySelector('.feedback-message');
        if(feedbackElement) feedbackElement.style.display = 'none';

        if (!fullName || !phoneNumber || !username || !password) { if(feedbackElement) displayFeedback(feedbackElement, "لطفاً تمام فیلدها را پر کنید.", 'error'); return; }
        if (!/^09[0-9]{9}$/.test(phoneNumber)) { if(feedbackElement) displayFeedback(feedbackElement, "شماره تماس معتبر نیست.", 'error'); return; }
        if (password.length < 3) { if(feedbackElement) displayFeedback(feedbackElement, "رمز عبور باید حداقل ۳ کاراکتر باشد.", 'error'); return; }

        const result = await callApi('adminRegisterUser', { fullName, phoneNumber, username, password }, true);
        
        if (result && result.success && result.user) {
            const newUser = result.user;
            if(authModal) authModal.style.display = 'none';
            if(adminAddUserForm) adminAddUserForm.reset();

            if (confirm(`کاربر ${newUser.fullName} با موفقیت ایجاد شد. آیا می‌خواهید اکنون زمان‌های حضور او را انتخاب کنید؟`)) {
                viewOrEditUserSelectionsAsAdmin(newUser, true);
            } else {
                handleAdminViewAllUsers();
            }
        } else {
            if(feedbackElement) displayFeedback(feedbackElement, result ? result.message : "ایجاد کاربر ناموفق بود.", 'error');
        }
    });

    async function handleAdminViewAllUsers() {
        if (!currentUser || !currentUser.isAdmin) return;
        selectingForUserByAdmin = null;
        currentSelections = [];
        showSection('admin-panel-section');

        if(adminContentArea) adminContentArea.innerHTML = '<h3>لیست تمام کاربران</h3><p>در حال بارگذاری...</p>';
        const result = await callApi('getAllUsers', {}, true);
        if(adminContentArea) adminContentArea.innerHTML = '<h3>لیست تمام کاربران</h3>';
        
        if (result && result.success && result.users) {
            const nonAdminUsers = result.users.filter(user => !(user.username.toLowerCase() === "admin" && user.isAdmin === true));
            if (nonAdminUsers.length === 0) {
                if(adminContentArea) adminContentArea.innerHTML += '<p>هیچ کاربری (به جز ادمین اصلی سیستم) ثبت نشده است.</p>';
                return;
            }
            const table = document.createElement('table');
            table.classList.add('admin-users-table');
            const header = table.createTHead().insertRow();
            ['نام کامل', 'شماره تماس', 'نام کاربری', 'ادمین؟', 'تاریخ ثبت', 'عملیات'].forEach(text => header.insertCell().textContent = text);
            const tbody = table.createTBody();
            nonAdminUsers.forEach(user => {
                const row = tbody.insertRow();
                row.insertCell().textContent = user.fullName;
                row.insertCell().textContent = user.phoneNumber;
                row.insertCell().textContent = user.username;
                row.insertCell().textContent = user.isAdmin ? 'بله' : 'خیر';
                row.insertCell().textContent = user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('fa-IR') : '-';
                const actionsCell = row.insertCell();
                const viewBtn = document.createElement('button');
                viewBtn.textContent = 'انتخاب/ویرایش زمان‌ها';
                viewBtn.classList.add('admin-action-button');
                viewBtn.onclick = () => viewOrEditUserSelectionsAsAdmin(user);
                actionsCell.appendChild(viewBtn);
            });
            if(adminContentArea) adminContentArea.appendChild(table);
        } else {
            if(adminContentArea) adminContentArea.innerHTML += `<p>خطا در بارگذاری کاربران: ${result ? result.message : 'خطای ناشناخته.'}</p>`;
        }
    }
    if(adminViewAllUsersBtn) adminViewAllUsersBtn.addEventListener('click', handleAdminViewAllUsers);
    

    async function viewOrEditUserSelectionsAsAdmin(userToHandle, isNewUser = false) {
        if (!currentUser || !currentUser.isAdmin || !userToHandle || !userToHandle.userId) {
            console.error("Invalid call to viewOrEditUserSelectionsAsAdmin", currentUser, userToHandle);
            alert("خطا: اطلاعات کاربر برای ویرایش ناقص است.");
            return;
        }
        selectingForUserByAdmin = userToHandle;
        selectingForUserByAdmin.isNewUserContext = isNewUser; // برای استفاده در handleCheckboxChangeForAdminEdit
        currentSelections = [];

        showLoading(true);
        showSection('admin-panel-section');
        if (adminActionsDiv) adminActionsDiv.style.display = 'none';
        
        if(adminContentArea) adminContentArea.innerHTML = `<h3>انتخاب/ویرایش زمان برای کاربر: ${userToHandle.fullName} (نام کاربری: ${userToHandle.username})</h3>
                                     <p>زمان‌های مورد نظر را انتخاب/لغو انتخاب کرده و سپس روی "ثبت انتخاب‌ها برای کاربر" کلیک کنید.</p>`;
        
        let userPreviousSelectionsForTable = [];
        if (!isNewUser) {
            const result = await callApi('getUserSelections', { userId: userToHandle.userId }, true);
            if (result && result.success && result.selections) {
                userPreviousSelectionsForTable = result.selections;
                currentSelections = [...userPreviousSelectionsForTable];
            } else {
                console.error("Failed to fetch previous selections for user:", userToHandle.username, result ? result.message : "");
            }
        }

        Object.keys(timeSlots).forEach(sectionKey => {
            const sectionDiv = document.createElement('div');
            sectionDiv.innerHTML = `<h2>بخش ${timeSlots[sectionKey].name}</h2>`;
            const tableContainer = document.createElement('div');
            tableContainer.id = `${sectionKey}-table-container-admin-edit-${userToHandle.userId}`;
            tableContainer.classList.add('table-container');
            sectionDiv.appendChild(tableContainer);
            if(adminContentArea) adminContentArea.appendChild(sectionDiv);
            generateTimetable(sectionKey, tableContainer.id, userPreviousSelectionsForTable);
        });
        
        regenerateAllTimetables(true, userPreviousSelectionsForTable);

        const finalizeButtonForAdmin = document.createElement('button');
        finalizeButtonForAdmin.id = 'finalize-selections-for-user-by-admin-btn';
        finalizeButtonForAdmin.textContent = 'ثبت انتخاب‌ها برای کاربر';
        finalizeButtonForAdmin.classList.add('admin-action-button');
        finalizeButtonForAdmin.style.marginTop = '20px';
        // دکمه در ابتدا غیرفعال است مگر اینکه انتخاباتی از قبل وجود داشته باشد یا کاربر جدید باشد
        finalizeButtonForAdmin.disabled = currentSelections.length === 0 && !isNewUser && userPreviousSelectionsForTable.length === 0; 
        if(adminContentArea) adminContentArea.appendChild(finalizeButtonForAdmin);

        finalizeButtonForAdmin.addEventListener('click', async () => {
            if (!selectingForUserByAdmin) { alert("خطا: کاربر نامشخص است."); return; }

            if (currentSelections.length === 0 && userPreviousSelectionsForTable.length > 0 && !selectingForUserByAdmin.isNewUserContext) {
                 if(!confirm("شما تمام زمان‌های انتخابی این کاربر را برداشته‌اید. آیا از حذف تمام انتخاب‌های او مطمئن هستید؟")){
                    return;
                 }
            } else if (currentSelections.length === 0 && selectingForUserByAdmin.isNewUserContext) {
                alert("هیچ زمانی برای کاربر جدید انتخاب نشده است. لطفاً حداقل یک زمان را انتخاب کنید یا از عملیات صرف نظر کنید.");
                return;
            }
            
            const resultSave = await callApi('saveSelections', { 
                userId: selectingForUserByAdmin.userId, 
                selections: currentSelections 
            }, true); 

            if (resultSave && resultSave.success) {
                alert(resultSave.message || `انتخاب‌ها برای کاربر ${selectingForUserByAdmin.fullName} با موفقیت ذخیره/به‌روزرسانی شد.`);
                selectingForUserByAdmin = null; 
                currentSelections = [];
                showSection('admin-panel-section');
                handleAdminViewAllUsers(); 
            } else {
                alert(`خطا در ذخیره‌سازی انتخاب‌ها: ${resultSave ? resultSave.message : 'خطای ناشناخته'}`);
            }
        });

        const backButton = document.createElement('button');
        backButton.textContent = 'بازگشت به لیست کاربران (بدون ذخیره)';
        backButton.classList.add('admin-action-button');
        backButton.style.backgroundColor = 'var(--medium-gray)';
        backButton.style.marginTop = '20px';
        backButton.style.marginRight = '10px';
        backButton.onclick = () => {
            if (confirm("آیا مطمئن هستید که می‌خواهید بدون ذخیره تغییرات بازگردید؟")) {
                selectingForUserByAdmin = null;
                currentSelections = [];
                showSection('admin-panel-section');
                handleAdminViewAllUsers();
            }
        };
        if(adminContentArea) adminContentArea.appendChild(backButton);
        showLoading(false);
    }
    
    function handleCheckboxChangeForAdminEdit(event) {
        const checkbox = event.target;
        const sel = { section: checkbox.dataset.section, day: checkbox.dataset.day, timeSlot: checkbox.dataset.slot };

        if (checkbox.checked) {
            if (!currentSelections.find(s => s.section === sel.section && s.day === sel.day && s.timeSlot === sel.timeSlot)) {
                currentSelections.push(sel);
            }
        } else {
            currentSelections = currentSelections.filter(s => !(s.section === sel.section && s.day === sel.day && s.timeSlot === sel.timeSlot));
        }
        
        const finalizeButtonForAdmin = document.getElementById('finalize-selections-for-user-by-admin-btn');
        if (finalizeButtonForAdmin && selectingForUserByAdmin) {
            let originalSelectionsForThisUser = []; // This would be populated from the state when the edit view was loaded
            // In viewOrEditUserSelectionsAsAdmin, userPreviousSelectionsForTable holds this
            // We need a way to compare currentSelections with the *initial* state of selections for this user.
            // For simplicity now, enable if any selection is made or if selections are cleared from a previously selected state.

            // Get original selections when viewOrEditUserSelectionsAsAdmin was called.
            // This is a simplified check. A more robust check would compare arrays deeply.
            let initialSelectionsForEditedUser = [];
            if(!selectingForUserByAdmin.isNewUserContext) {
                // This assumes userPreviousSelections was correctly populated when the edit view was loaded.
                // However, that variable is global and might not reflect the specific user being edited.
                // A better approach is to pass the initial selections to this handler or store it.
                // For now, we rely on a simpler logic:
                // If currentSelections has items OR if it's empty but there WERE items (meaning user cleared all)
                 // Let's find the originally loaded selections for this user to compare against
                // This is still tricky without passing the original state directly to this handler.
                // A simple approximation:
                const previousSelectionsForThisSpecificUser = previousUserSelections.filter(ps => ps.userId === selectingForUserByAdmin.userId);

                if (currentSelections.length > 0) {
                    finalizeButtonForAdmin.disabled = false;
                } else { // currentSelections is empty
                    // Check if there were selections loaded initially for this user when edit mode started
                    // This requires knowing what those initial selections were.
                    // Let's assume if userPreviousSelectionsForTable (from viewOrEditUserSelectionsAsAdmin) had items, then allow saving "empty".
                    // This logic is still imperfect for enabling/disabling precisely based on "changes".
                    // Safest is to enable if currentSelections.length > 0 or if user had prev selections and now current is 0
                    finalizeButtonForAdmin.disabled = false; // Allow saving even if clearing all selections
                }

            } else if (selectingForUserByAdmin.isNewUserContext) { // User is new
                finalizeButtonForAdmin.disabled = currentSelections.length === 0;
            }
        }
    }

    async function handleAdminViewAggregatedReport() {
        if (!currentUser || !currentUser.isAdmin) return;
        if (selectingForUserByAdmin) {
            alert("لطفاً ابتدا عملیات انتخاب زمان برای کاربر را تمام کرده یا لغو کنید.");
            return;
        }
        showSection('admin-panel-section');

        if(adminContentArea) adminContentArea.innerHTML = '<h3>گزارش تجمیعی حضور (تعداد نفرات در هر بازه)</h3><p>در حال بارگذاری...</p>';
        const result = await callApi('getAggregatedReport', {}, true);
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
                header.insertCell().textContent = "روز / ساعت";
                sectionConfig.slots.forEach(slot => header.appendChild(document.createElement('th')).textContent = slot);
                const tbody = table.createTBody();
                sectionConfig.days.forEach(day => {
                    const row = tbody.insertRow();
                    row.insertCell().textContent = `روز ${day}`;
                    row.cells[0].classList.add('day-header');
                    sectionConfig.slots.forEach(slot => {
                        const cell = row.insertCell();
                        const reportKey = `${sectionKey}-${day}-${slot}`;
                        cell.textContent = reportData[reportKey] || 0;
                        cell.classList.add((reportData[reportKey] > 0) ? 'has-volunteers' : 'no-volunteers');
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
        updateUIForLoginState();
        showSection('welcome-message');
        const placeholderUrlPart = "YOUR_DEPLOYMENT_ID";
        if (!SCRIPT_URL || SCRIPT_URL.includes(placeholderUrlPart) || SCRIPT_URL.length < 70 || (SCRIPT_URL.endsWith("/exec") && SCRIPT_URL.split('/').slice(-2, -1)[0].length < 30)) {
            const configErrorMessage = "خطای پیکربندی: URL مربوط به Apps Script به درستی تنظیم نشده است. لطفاً فایل script.js را ویرایش کرده و مقدار SCRIPT_URL را با URL صحیح از بخش Deployments در Apps Script جایگزین نمایید.";
            alert(configErrorMessage);
            showLoading(false);
            const mainContent = document.querySelector('main');
            const errorHtml = `<h1 style='color:red; text-align:center; margin-top: 50px;'>${configErrorMessage}</h1>`;
            if (mainContent) { mainContent.innerHTML = errorHtml; } else { document.body.innerHTML = errorHtml; }
            document.querySelectorAll('button:not(.close-btn)').forEach(btn => btn.disabled = true);
            return;
        }
        showInitialWelcome();
    }

    function showInitialWelcome() {
        const overlay = document.getElementById('initial-welcome-overlay');
        if (overlay) {
            document.body.style.overflow = 'hidden';
            setTimeout(() => {
                overlay.classList.add('hidden');
                document.body.style.overflow = 'auto';
            }, 4000);
        }
    }

    init();
});
