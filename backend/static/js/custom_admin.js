if (!window.customAdminInitialized) {
    window.customAdminInitialized = true;
    document.addEventListener('DOMContentLoaded', function () {

    // ============================================
    // 1. CHANGE LIST PAGE LOGIC (Search & Delete)
    // ============================================
    var actionForm = document.getElementById('changelist-form');
    var searchBar = document.querySelector('#changelist-search');

    if (actionForm && searchBar) {
        var actionSelect = actionForm.querySelector('select[name="action"]');
        var actionsRow = document.querySelector('.actions');

        if (actionSelect && actionsRow) {
            // --- In-page toast notification ---
            var toast = document.createElement('div');
            toast.id = 'admin-custom-toast';
            toast.style.cssText = [
                'position: fixed',
                'top: 80px',
                'left: 50%',
                'transform: translateX(-50%) translateY(-20px)',
                'background: #dc3545',
                'color: #fff',
                'padding: 12px 24px',
                'border-radius: 6px',
                'font-size: 14px',
                'font-weight: 500',
                'box-shadow: 0 4px 16px rgba(0,0,0,0.18)',
                'z-index: 99999',
                'opacity: 0',
                'transition: opacity 0.3s ease, transform 0.3s ease',
                'pointer-events: none'
            ].join(';');
            document.body.appendChild(toast);

            function showToast(message) {
                toast.textContent = message;
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(-50%) translateY(0)';
                setTimeout(function () {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(-50%) translateY(-20px)';
                }, 3000);
            }

            // --- Delete Selected button ---
            var deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.textContent = 'Delete Selected';
            deleteBtn.style.cssText = [
                'margin-left: auto',
                'padding: 6px 16px',
                'background-color: #dc3545',
                'color: #fff',
                'border: none',
                'border-radius: 4px',
                'font-size: 13px',
                'cursor: pointer',
                'white-space: nowrap',
                'display: inline-block'
            ].join(';');

            deleteBtn.addEventListener('mouseover', function () {
                this.style.backgroundColor = '#c82333';
            });
            deleteBtn.addEventListener('mouseout', function () {
                this.style.backgroundColor = '#dc3545';
            });

            deleteBtn.addEventListener('click', function () {
                var checked = actionForm.querySelectorAll('input[name="_selected_action"]:checked');
                if (checked.length === 0) {
                    showToast('⚠ Please select at least one user to delete.');
                    return;
                }
                actionSelect.value = 'delete_selected';
                var goBtn = actionForm.querySelector('[name="index"]');
                if (goBtn) {
                    goBtn.click();
                } else {
                    actionForm.submit();
                }
            });

            // Place button on right side of search bar
            searchBar.style.cssText = 'display:flex; align-items:center; gap:8px; width:100%;';
            searchBar.appendChild(deleteBtn);

            // Hide the original actions toolbar row
            actionsRow.style.display = 'none';
        }
    }

    // ============================================
    // 2. ADD/EDIT ADMIN LOGIC (Next Button on Step 1 & Top Right Select)
    // ============================================
    var createAdminTab = document.getElementById('create-admin-tab');
    var roleAccessTabLink = document.querySelector('a[href="#role-access-permissions-tab"]');

    if (createAdminTab && roleAccessTabLink) {
        var nextContainer = document.createElement('div');
        nextContainer.style.cssText = 'display: flex; justify-content: flex-end; padding: 20px 0; border-top: 1px solid #eee; margin-top: 20px;';

        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.innerHTML = 'Next &nbsp;➔';
        nextBtn.style.cssText = 'padding: 8px 24px; background-color: #007bff; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 14px;';

        nextBtn.addEventListener('mouseover', function () {
            this.style.backgroundColor = '#0056b3';
        });
        nextBtn.addEventListener('mouseout', function () {
            this.style.backgroundColor = '#007bff';
        });

        nextBtn.addEventListener('click', function (e) {
            e.preventDefault();
            roleAccessTabLink.click();
        });

        nextContainer.appendChild(nextBtn);
        createAdminTab.appendChild(nextContainer);
    }

    // Move existing user select box directly into the tab bar to line it up perfectly opposite the tabs
    var existingUserField = document.querySelector('.field-existing_user_email');
    var navTabs = document.querySelector('ul.nav-tabs'); // Target the actual tabs list in Jazzmin

    if (existingUserField && navTabs) {
        // We will move it out of the fieldset entirely and place it safely in the tab navigation row itself
        var tabContainer = navTabs.parentElement; // The div holding the nav tabs

        // Remove label
        var label = existingUserField.querySelector('label');
        if (label) label.style.display = 'none';

        // Add Search Button
        var searchBtn = document.createElement('button');
        searchBtn.type = 'button';
        searchBtn.textContent = 'Search';
        searchBtn.style.cssText = 'padding: 6px 14px; background-color: #17a2b8; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 13px; margin-left: 8px; white-space: nowrap; flex-shrink: 0;';

        searchBtn.addEventListener('click', function (e) {
            e.preventDefault();
            var selectObj = existingUserField.querySelector('select');
            if (selectObj) {
                selectObj.focus();
                if (window.jQuery && jQuery(selectObj).data('select2')) {
                    jQuery(selectObj).select2('open');
                } else if (window.jQuery && jQuery(selectObj).hasClass('select2-hidden-accessible')) {
                    jQuery(selectObj).select2('open');
                }
            }
        });

        var controlsDiv = existingUserField.querySelector('div') || existingUserField.querySelector('.controls');
        if (controlsDiv) {
            controlsDiv.style.display = 'flex';
            controlsDiv.style.alignItems = 'center';
            controlsDiv.style.width = '100%';
            controlsDiv.appendChild(searchBtn);

            var selectEl = controlsDiv.querySelector('select');
            if (selectEl) selectEl.style.flex = '1 1 auto';
            var select2Span = controlsDiv.querySelector('.select2-container');
            if (select2Span) select2Span.style.flex = '1 1 auto';
        } else {
            existingUserField.appendChild(searchBtn);
        }

        // Now style the 'existingUserField' container to sit smoothly in the tab row
        existingUserField.style.cssText = 'margin-left: auto; display: flex; align-items: center; padding-right: 15px; margin-bottom: 0; width: auto; max-width: 40%;';
        existingUserField.classList.remove('form-row', 'field-existing_user_email'); // strip django margin styles

        // Ensure navTabs is a flexbox so we can push this item to the right
        navTabs.style.display = 'flex';
        navTabs.style.width = '100%';
        navTabs.style.alignItems = 'center';

        // Physically move the DOM element into the tab bar
        navTabs.appendChild(existingUserField);
    }

    // ============================================
    // 3. DISABLE SIDEBAR HOVER EXPANSION
    // ============================================
    // This tells AdminLTE to stop expanding the sidebar when the mouse moves over it.
    var sidebar = document.querySelector('.main-sidebar');
    if (sidebar) {
        sidebar.classList.add('sidebar-no-expand');
    }

    // ============================================
    // 3.5. FORCE BLACK COLOR FOR SIDEBAR USERNAME
    // ============================================
    // Ensures that the username on the sidebar is styled in high-visibility black color
    var userPanelLinks = document.querySelectorAll('.user-panel .info a, .user-panel .info span, .user-panel a, .user-panel span');
    userPanelLinks.forEach(function (el) {
        el.style.setProperty('color', '#000000', 'important');
        el.style.setProperty('font-weight', '500', 'important');
    });

    // ============================================
    // 4. RESTORE "SEE PROFILE" FOR SUB-ADMINS
    // ============================================
    var userDropdownMenu = document.getElementById('jazzy-usermenu');
    if (userDropdownMenu) {
        var hasSeeProfile = userDropdownMenu.textContent.includes('See Profile');

        if (!hasSeeProfile) {
            var profileLink = document.createElement('a');
            profileLink.href = '/admin/users/adminuser/my-profile/';
            profileLink.className = 'dropdown-item dropdown-footer';
            profileLink.innerHTML = 'See Profile';

            var divider = document.createElement('div');
            divider.className = 'dropdown-divider';

            userDropdownMenu.appendChild(divider);
            userDropdownMenu.appendChild(profileLink);
        }
    }

    // ============================================
    // 5. STRICT PHONE NUMBER CHARACTER FILTERING
    // ============================================
    // Scans the page for any phone number input fields in the Django Admin and attaches a live keyup/input filter
    function applyPhoneFilters() {
        var phoneInputs = document.querySelectorAll('input[id*="phone"], input[name*="phone"], input[type="tel"]');
        phoneInputs.forEach(function (input) {
            if (!input.dataset.phoneFilterAttached) {
                input.dataset.phoneFilterAttached = "true";
                input.maxLength = 10; // Enforce max 10 digits at HTML attribute level
                
                // Block letters and other invalid characters in real-time as the user types
                var filterFn = function () {
                    var cleaned = input.value.replace(/[^0-9]/g, ''); // Digits only
                    if (cleaned.length > 10) {
                        cleaned = cleaned.substring(0, 10);
                    }
                    if (input.value !== cleaned) {
                        input.value = cleaned;
                    }
                };
                
                input.addEventListener('input', filterFn);
                input.addEventListener('keyup', filterFn);
                input.addEventListener('blur', filterFn);
            }
        });
    }

    // Run initially and periodically to cover any dynamic / inline form additions
    applyPhoneFilters();
    setInterval(applyPhoneFilters, 1000);
    });
}
