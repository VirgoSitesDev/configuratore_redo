class SimpleNavigationProtection {
    constructor() {
        this.hasChanges = false;
        this.isSubmitting = false;
        this.isShowingModal = false;
        this.init();
    }
    
    init() {
        this.createCustomModal();
        this.setupBeforeUnloadWarning();
        this.setupBackButtonProtection();
        this.setupChangeTracking();
    }

    createCustomModal() {
        const modalHTML = `
            <div id="navigation-confirm-modal" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    max-width: 450px;
                    width: 90%;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    text-align: center;
                ">
                    <div style="
                        font-size: 48px;
                        margin-bottom: 16px;
                    ">⚠️</div>
                    <h3 style="
                        margin: 0 0 12px 0;
                        font-size: 20px;
                        color: #333;
                        font-weight: 600;
                    ">Attenzione!</h3>
                    <p style="
                        margin: 0 0 24px 0;
                        color: #666;
                        font-size: 16px;
                        line-height: 1.5;
                    ">Hai delle modifiche non salvate alla configurazione. Sei sicuro di voler lasciare questa pagina?</p>
                    <div style="
                        display: flex;
                        gap: 12px;
                        justify-content: center;
                    ">
                        <button id="modal-stay-btn" style="
                            padding: 12px 24px;
                            background: #e83f34;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: background 0.2s;
                        ">Rimani qui</button>
                        <button id="modal-leave-btn" style="
                            padding: 12px 24px;
                            background: #f5f5f5;
                            color: #333;
                            border: none;
                            border-radius: 6px;
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: background 0.2s;
                        ">Lascia pagina</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('modal-stay-btn').addEventListener('click', () => {
            this.hideConfirmModal();
            this.isShowingModal = false;
        });
        
        document.getElementById('modal-leave-btn').addEventListener('click', () => {
            this.isShowingModal = false;
            this.hasChanges = false;
            this.hideConfirmModal();

            if (this.pendingNavigation) {
                this.pendingNavigation();
                this.pendingNavigation = null;
            }
        });
    }
    
    showConfirmModal(onLeave) {
        if (this.isShowingModal) return false;
        
        this.isShowingModal = true;
        this.pendingNavigation = onLeave;
        
        const modal = document.getElementById('navigation-confirm-modal');
        modal.style.display = 'flex';

        setTimeout(() => {
            document.getElementById('modal-stay-btn').focus();
        }, 100);
        
        return false;
    }
    
    hideConfirmModal() {
        const modal = document.getElementById('navigation-confirm-modal');
        modal.style.display = 'none';
    }

    setupBeforeUnloadWarning() {
        window.addEventListener('beforeunload', (e) => {
            if (this.hasChanges && !this.isSubmitting) {
                const message = 'Hai delle modifiche non salvate. Sei sicuro di voler lasciare questa pagina?';
                e.preventDefault();
                e.returnValue = message;
                return message;
            }
        });
    }

    setupBackButtonProtection() {
        if (!history.state || !history.state.configPage) {
            history.pushState({ configPage: true }, null, window.location.href);
        }
        
        window.addEventListener('popstate', (e) => {
            
            if (this.hasChanges && !this.isSubmitting && !this.isShowingModal) {
                history.pushState({ configPage: true }, null, window.location.href);

                this.showConfirmModal(() => {
                    history.back();
                });
                
                return;
            }
        });

        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (link && this.hasChanges && !this.isSubmitting && !this.isShowingModal) {
                const href = link.getAttribute('href');

                if (href && !href.startsWith('#') && !href.startsWith('javascript:') && 
                    (href.startsWith('http') || href.startsWith('/'))) {
                    
                    e.preventDefault();
                    
                    this.showConfirmModal(() => {
                        window.location.href = href;
                    });
                    
                    return false;
                }
            }
        });
    }

    setupChangeTracking() {
        document.addEventListener('change', (e) => {
            if (e.target.matches('select, input, textarea')) {
                this.markAsChanged();
            }
        });

        document.addEventListener('click', (e) => {
            const button = e.target.closest('button, .btn, a[role="button"]');
            
            if (button && this.isConfigurationButton(button)) {
                this.markAsChanged();
            }
        });

        document.addEventListener('input', (e) => {
            if (e.target.matches('input[type="text"], input[type="number"], textarea')) {
                this.markAsChanged();
            }
        });
    }

    isConfigurationButton(button) {
        const buttonText = button.textContent.toLowerCase().trim();
        const navigationKeywords = [
            'continua', 'indietro', 'avanti', 'prossimo', 'precedente', 'next', 'prev', 'back',
            'salva', 'invia', 'submit', 'conferma', 'annulla', 'chiudi', 'close', 'cancel'
        ];
        
        const hasNavigationKeyword = navigationKeywords.some(keyword => 
            buttonText.includes(keyword)
        );
        
        if (hasNavigationKeyword) {
            return false;
        }

        const navigationClasses = [
            'btn-continue', 'btn-back', 'btn-next', 'btn-prev', 
            'btn-save', 'btn-submit', 'btn-cancel', 'btn-close'
        ];
        
        const hasNavigationClass = navigationClasses.some(className => 
            button.classList.contains(className)
        );
        
        if (hasNavigationClass) {
            return false;
        }

        const parent = button.closest('.options, .form-group, .btn-group, .selection-group');
        if (parent) {
            return true;
        }
        
        return false;
    }

    markAsChanged() {
        if (!this.hasChanges) {
            this.hasChanges = true;
        }
    }
    
    markAsSaved() {
        this.hasChanges = false;
    }
    
    disableTemporarily() {
        const wasActive = this.hasChanges;
        this.isSubmitting = true;
        
        setTimeout(() => {
            this.isSubmitting = false;
            if (wasActive) {
                console.log('🔄 Protezione riabilitata');
            }
        }, 3000);
    }
    
    showUnsavedIndicator() {
        let indicator = document.getElementById('unsaved-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'unsaved-indicator';
            indicator.innerHTML = '⚠️ Modifiche non salvate';
            indicator.style.cssText = `
                position: fixed;
                top: 15px;
                right: 15px;
                background: #ff9800;
                color: white;
                padding: 10px 15px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                z-index: 9999;
                box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                animation: slideIn 0.5s ease;
                cursor: default;
                user-select: none;
            `;
            document.body.appendChild(indicator);

            this.addIndicatorStyles();
        }
        indicator.style.display = 'block';
    }
    
    hideUnsavedIndicator() {
        const indicator = document.getElementById('unsaved-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
    
    addIndicatorStyles() {
        if (!document.getElementById('navigation-protection-styles')) {
            const style = document.createElement('style');
            style.id = 'navigation-protection-styles';
            style.textContent = `
                @keyframes slideIn {
                    0% { opacity: 0; transform: translateX(100%); }
                    100% { opacity: 1; transform: translateX(0); }
                }
                
                #modal-stay-btn:hover { background: #d73529 !important; }
                #modal-leave-btn:hover { background: #e0e0e0 !important; }
                
                @media (max-width: 768px) {
                    #unsaved-indicator {
                        top: 10px !important;
                        right: 10px !important;
                        left: 10px !important;
                        text-align: center !important;
                        font-size: 12px !important;
                        padding: 8px 12px !important;
                    }
                    
                    #navigation-confirm-modal > div {
                        margin: 20px !important;
                        padding: 24px !important;
                    }
                    
                    #navigation-confirm-modal button {
                        width: 100% !important;
                        margin-bottom: 8px !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    testProtection() {
        this.markAsChanged();
    }

    reset() {
        this.hasChanges = false;
        this.isSubmitting = false;
        this.hideUnsavedIndicator();
    }

    getStatus() {
        return {
            hasChanges: this.hasChanges,
            isSubmitting: this.isSubmitting,
            isShowingModal: this.isShowingModal
        };
    }
}

let navigationProtection;

document.addEventListener('DOMContentLoaded', function() {
    navigationProtection = new SimpleNavigationProtection();

    setTimeout(() => {
        autoIntegrateWithExistingCode();
    }, 1000);

    setTimeout(() => {
        navigationProtection.testProtection();
        
        setTimeout(() => {
        }, 1000);
    }, 2000);
});

function autoIntegrateWithExistingCode() {
    const functionsToIntercept = [
        'salvaConfigurazione',
        'finalizzaConfigurazione', 
        'inviaPreventivo'
    ];
    
    functionsToIntercept.forEach(funcName => {
        if (typeof window[funcName] === 'function') {
            const original = window[funcName];
            window[funcName] = function() {
                
                if (navigationProtection) {
                    navigationProtection.disableTemporarily();
                }
                
                const result = original.apply(this, arguments);
                
                if (result && typeof result.then === 'function') {
                    result.then((response) => {
                        if (response && response.success && navigationProtection) {
                            navigationProtection.markAsSaved();
                        }
                    });
                } else if (result && result.success && navigationProtection) {
                    navigationProtection.markAsSaved();
                }
                
                return result;
            };
        }
    });

    document.addEventListener('submit', function(e) {
        if (navigationProtection) {
            navigationProtection.disableTemporarily();
        }
    });
}

window.markConfigurationChanged = function() {
    if (navigationProtection) {
        navigationProtection.markAsChanged();
    }
};

window.markConfigurationSaved = function() {
    if (navigationProtection) {
        navigationProtection.markAsSaved();
    }
};

window.disableNavigationProtection = function() {
    if (navigationProtection) {
        navigationProtection.disableTemporarily();
    }
};

window.testNavigationProtection = function() {
    if (navigationProtection) {
        navigationProtection.testProtection();
    }
};

window.getNavigationProtectionStatus = function() {
    return navigationProtection ? navigationProtection.getStatus() : null;
};

window.navigationProtection = navigationProtection;