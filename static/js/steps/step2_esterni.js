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
            $('#tipologie-options').empty().html('<div class="text-center mt-3"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento opzioni...</p></div>');
            
            caricaOpzioniProfilo(configurazione.profiloSelezionato);

            $("#step2-modello-esterni").fadeOut(300, function() {
                setTimeout(() => {
                    if ($('.tipologia-card').length === 1 && $('.tipologia-card').data('id') === 'taglio_misura') {
                        $('.tipologia-card').click();
                        configurazione.tipologiaSelezionata = 'taglio_misura';
                        
                        import('./step2.js').then(module => {
                            module.vaiAllaPersonalizzazione();
                        });
                    } else {
                        $("#step2-modello").fadeIn(300);
                        updateProgressBar(4);
                    }
                }, 500);
            });
        }
    });
}

export function vaiAllaSelezioneProfiliPerEsterni() {

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

    $(document).off('click', '.profilo-card-esterni');

    console.log("=== DEBUG CARICAMENTO PROFILI ===");
    console.log("Categoria selezionata:", configurazione.categoriaSelezionata);
    console.log("Strip da cercare:", configurazione.stripLedSelezionata);

    $.ajax({
        url: `/get_profili/${configurazione.categoriaSelezionata}`,
        method: 'GET',
        success: function(data) {
            console.log("Dati ricevuti dal server:", data);
            console.log("Numero profili ricevuti:", data ? data.length : 0);
            
            $('#profili-esterni-container').empty();
            
            if (!data || data.length === 0) {
                $('#profili-esterni-container').html(
                    '<div class="col-12 text-center"><p>Nessun profilo disponibile per questa categoria.</p></div>'
                );
                return;
            }

            // Debug: mostra tutti i profili e le loro compatibilità
            console.log("=== ANALISI PROFILI RICEVUTI ===");
            data.forEach((profilo, index) => {
                console.log(`Profilo ${index + 1}:`, {
                    id: profilo.id,
                    nome: profilo.nome,
                    stripLedCompatibili: profilo.stripLedCompatibili || []
                });
            });

            const profiliCompatibili = filtraProfiliPerStripSelezionata(data);
            
            if (profiliCompatibili.length === 0) {
                console.log("⚠️ NESSUN PROFILO COMPATIBILE TROVATO!");
                console.log("Possibili cause:");
                console.log("1. ID strip non corrisponde");
                console.log("2. Dati compatibilità mancanti");
                console.log("3. Errore nel filtro");
                
                $('#profili-esterni-container').html(
                    '<div class="col-12 text-center"><p>Nessun profilo compatibile con la strip LED configurata.</p><p class="small text-muted">ID Strip cercato: ' + configurazione.stripLedSelezionata + '</p></div>'
                );
                return;
            }

            // Resto del codice per mostrare i profili...
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

    console.log("=== DEBUG FILTRO PROFILI ===");
    console.log("Strip selezionata dalla configurazione:", stripSelezionata);
    console.log("Tipo di stripSelezionata:", typeof stripSelezionata);
    console.log("Totale profili da filtrare:", profili.length);

    if (!stripSelezionata || stripSelezionata === 'NO_STRIP') {
        console.log("Nessuna strip selezionata, ritorno tutti i profili");
        return profili;
    }
    
    // Debug: mostra cosa c'è in configurazione
    console.log("Configurazione completa strip:", {
        stripLedSelezionata: configurazione.stripLedSelezionata,
        nomeCommercialeStripLed: configurazione.nomeCommercialeStripLed,
        tensioneSelezionato: configurazione.tensioneSelezionato,
        ipSelezionato: configurazione.ipSelezionato,
        temperaturaSelezionata: configurazione.temperaturaSelezionata,
        tipologiaStripSelezionata: configurazione.tipologiaStripSelezionata,
        specialStripSelezionata: configurazione.specialStripSelezionata
    });
    
    const profiliCompatibili = profili.filter((profilo, index) => {
        console.log(`\n--- Profilo ${index + 1}: ${profilo.nome} (ID: ${profilo.id}) ---`);
        
        if (!profilo.stripLedCompatibili || profilo.stripLedCompatibili.length === 0) {
            console.log("❌ Profilo senza stripLedCompatibili");
            return false;
        }
        
        console.log("Strip compatibili per questo profilo:", profilo.stripLedCompatibili);
        console.log("Lunghezza array compatibili:", profilo.stripLedCompatibili.length);
        
        // Verifica se la strip selezionata è nell'array
        const isCompatibile = profilo.stripLedCompatibili.includes(stripSelezionata);
        console.log(`Verifica include('${stripSelezionata}'):`, isCompatibile);
        
        // Debug aggiuntivo: verifica corrispondenze parziali
        const matchParziali = profilo.stripLedCompatibili.filter(strip => 
            strip.includes('ZIGZAG') || strip.includes('24V') || strip.includes('IP')
        );
        console.log("Strip compatibili che contengono ZIGZAG/24V/IP:", matchParziali);
        
        if (isCompatibile) {
            console.log("✅ Profilo COMPATIBILE");
        } else {
            console.log("❌ Profilo NON compatibile");
        }
        
        return isCompatibile;
    });

    console.log(`\n=== RISULTATO FILTRO ===`);
    console.log(`Profili compatibili trovati: ${profiliCompatibili.length} su ${profili.length}`);
    console.log("IDs profili compatibili:", profiliCompatibili.map(p => p.id));

    return profiliCompatibili;
}