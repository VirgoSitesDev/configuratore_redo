import { configurazione, mappaCategorieVisualizzazione } from '../config.js';
import { updateProgressBar } from '../utils.js';
import { caricaOpzioniProfilo } from '../api.js';

export function initStep2EsterniListeners() {
    $('#btn-torna-step2-esterni').on('click', function(e) {
        e.preventDefault();
        $("#step2-modello-esterni").fadeOut(300, function() {
            $("#step3-temperatura-potenza").fadeIn(300);
            updateProgressBar(3);
        });
    });
    
    $('#btn-continua-step2-esterni').on('click', function(e) {
        e.preventDefault();
        if (configurazione.profiloSelezionato) {
            // Prima carica le opzioni del profilo (tipologie)
            $('#tipologie-options').empty().html('<div class="text-center mt-3"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento opzioni...</p></div>');
            
            caricaOpzioniProfilo(configurazione.profiloSelezionato);
            
            // Poi vai alla personalizzazione
            $("#step2-modello-esterni").fadeOut(300, function() {
                // Mostra direttamente la personalizzazione se c'è solo "taglio su misura"
                setTimeout(() => {
                    if ($('.tipologia-card').length === 1 && $('.tipologia-card').data('id') === 'taglio_misura') {
                        $('.tipologia-card').click();
                        configurazione.tipologiaSelezionata = 'taglio_misura';
                        
                        import('./step2.js').then(module => {
                            module.vaiAllaPersonalizzazione();
                        });
                    } else {
                        // Altrimenti mostra le opzioni di tipologia
                        $("#step2-modello").fadeIn(300);
                        updateProgressBar(4);
                    }
                }, 500);
            });
        }
    });
}

export function vaiAllaSelezioneProfiliPerEsterni() {
    console.log("Navigazione a selezione profili per esterni");

    $(".step-section").hide();
    $("#step2-modello-esterni").fadeIn(300);
    updateProgressBar(4);

    $('#categoria-nome-step2-modello-esterni').text(
        mappaCategorieVisualizzazione[configurazione.categoriaSelezionata] || configurazione.categoriaSelezionata
    );
    $('#strip-configurata-esterni').text(
        configurazione.nomeCommercialeStripLed || 'Strip LED configurata'
    );

    caricaProfiliCompatibiliConStrip();
}

export function caricaProfiliCompatibiliConStrip() {
    $('#profili-esterni-container').empty().html(
        '<div class="text-center mt-5"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento profili compatibili...</p></div>'
    );

    // Prima di tutto, rimuovi eventuali event listener precedenti
    $(document).off('click', '.profilo-card-esterni');

    $.ajax({
        url: `/get_profili/${configurazione.categoriaSelezionata}`,
        method: 'GET',
        success: function(data) {
            $('#profili-esterni-container').empty();
            
            if (!data || data.length === 0) {
                $('#profili-esterni-container').html(
                    '<div class="col-12 text-center"><p>Nessun profilo disponibile per questa categoria.</p></div>'
                );
                return;
            }

            const profiliCompatibili = filtraProfiliPerStripSelezionata(data);
            
            if (profiliCompatibili.length === 0) {
                $('#profili-esterni-container').html(
                    '<div class="col-12 text-center"><p>Nessun profilo compatibile con la strip LED configurata.</p></div>'
                );
                return;
            }

            let grid = $('<div class="row"></div>');
            $('#profili-esterni-container').append(grid);
            
            profiliCompatibili.forEach(function(profilo) {
                const profiloId = profilo.id || 'unknown';
                const profiloNome = profilo.nome || 'Profilo senza nome';
                
                let profiloCard = $(`
                    <div class="col-md-4 col-sm-6 mb-4 profilo-card-row">
                        <div class="card profilo-card-esterni" 
                             data-id="${profiloId}" 
                             data-nome="${profiloNome}"
                             style="cursor: pointer;">
                            <img src="${profilo.immagine || '/static/img/placeholder_logo.jpg'}" 
                                 class="card-img-top" alt="${profiloNome}" 
                                 onerror="this.src='/static/img/placeholder_logo.jpg'">
                            <div class="card-body">
                                <h5 class="card-title">${profiloNome}</h5>
                                <p class="card-text small text-muted">Compatibile con la tua strip LED</p>
                            </div>
                        </div>
                    </div>
                `);
                
                grid.append(profiloCard);
            });

            // Gestisci il click sui profili
            $(document).on('click', '.profilo-card-esterni', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const $card = $(this);
                const id = $card.data('id');
                const nome = $card.data('nome');

                $('.profilo-card-esterni').removeClass('selected');
                $card.addClass('selected');
                configurazione.profiloSelezionato = id;
                configurazione.nomeModello = nome;
                
                // Abilita il pulsante continua
                $('#btn-continua-step2-esterni').prop('disabled', false);
            });
        },
        error: function(error) {
            console.error("Errore nel caricamento dei profili:", error);
            $('#profili-esterni-container').html(
                '<div class="col-12 text-center"><p class="text-danger">Errore nel caricamento dei profili. Riprova più tardi.</p></div>'
            );
        }
    });
}

function filtraProfiliPerStripSelezionata(profili) {
    const stripSelezionata = configurazione.stripLedSelezionata;
    
    if (!stripSelezionata || stripSelezionata === 'NO_STRIP') {
        return profili;
    }
    
    return profili.filter(profilo => {
        if (!profilo.stripLedCompatibili || profilo.stripLedCompatibili.length === 0) {
            return false;
        }
        
        const stripCompatibili = profilo.stripLedCompatibili;
        
        // Controlla se la strip selezionata è direttamente compatibile
        if (stripCompatibili.includes(stripSelezionata)) {
            return true;
        }
        
        // Per strip speciali, controlla compatibilità basata su keywords
        if (configurazione.tipologiaStripSelezionata === 'SPECIAL' && configurazione.specialStripSelezionata) {
            const specialKeywords = {
                'XFLEX': ['XFLEX'],
                'XSNAKE': ['XSNAKE'],
                'XMAGIS': ['XMAGIS', 'MG13X12', 'MG12X17'],
                'ZIG_ZAG': ['ZIGZAG', 'ZIG_ZAG'],
                'RUNNING': ['RUNNING']
            };
            
            const keywords = specialKeywords[configurazione.specialStripSelezionata] || [];
            return stripCompatibili.some(stripId => 
                keywords.some(keyword => stripId.toUpperCase().includes(keyword))
            );
        }
        
        // Per strip normali, controlla compatibilità basata su tipo
        if (configurazione.tipologiaStripSelezionata === 'COB') {
            return stripCompatibili.some(id => 
                id.includes('COB') && 
                id.includes(configurazione.tensioneSelezionato) &&
                id.includes(configurazione.ipSelezionato)
            );
        } else if (configurazione.tipologiaStripSelezionata === 'SMD') {
            return stripCompatibili.some(id => 
                id.includes('SMD') && 
                id.includes(configurazione.tensioneSelezionato) &&
                id.includes(configurazione.ipSelezionato)
            );
        }
        
        return false;
    });
}