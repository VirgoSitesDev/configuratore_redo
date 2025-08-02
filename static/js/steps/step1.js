import { configurazione, mappaCategorieVisualizzazione } from '../config.js';
import { updateProgressBar } from '../utils.js';
import { caricaProfili } from '../api.js';

export function initStep1Listeners() {
  // Gestione hotspot per entrambe le pagine (indoor e outdoor)
  $('.hotspot').on('click', function() {
    const categoria = $(this).data('categoria');
    if (!categoria) {
      console.error("Nessuna categoria trovata per questo hotspot");
      return;
    }
    configurazione.categoriaSelezionata = categoria;

    if (categoria === 'esterni' || categoria === 'wall_washer_ext') {
        configurazione.isFlussoProfiliEsterni = true;
        
        $('.categoria-selezionata').text(`Categoria: ${mappaCategorieVisualizzazione[categoria] || categoria}`);
        updateProgressBar(2);
        
        $("#step1-tipologia-outdoor").fadeOut(300, function() {
            $("#step2-tipologia-strip").fadeIn(300);
            import('./step2.js').then(module => {
                module.prepareTipologiaStripListeners();
            });
        });
    } else {
        configurazione.isFlussoProfiliEsterni = false;
        
        $('.categoria-selezionata').text(`Categoria: ${mappaCategorieVisualizzazione[categoria] || categoria}`);
        updateProgressBar(2);
        
        $("#step1-tipologia-indoor").fadeOut(300, function() {
            $("#step2-modello").fadeIn(300);
            caricaProfili(categoria);
        });
    }
});
  
  // Gestione pulsante "Torna alla selezione tipologia" dallo step2-modello
  $('.btn-torna-indietro').on('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const categoriaCorrente = configurazione.categoriaSelezionata;
    
    $("#step2-modello").fadeOut(300, function() {
      // Determina se tornare alla pagina indoor o outdoor in base alla categoria corrente
      if (categoriaCorrente === 'esterni' || categoriaCorrente === 'wall_washer_ext') {
        $("#step1-tipologia-outdoor").fadeIn(300);
      } else {
        $("#step1-tipologia-indoor").fadeIn(300);
      }
      
      // Reset delle variabili di configurazione
      configurazione.categoriaSelezionata = null;
      configurazione.profiloSelezionato = null;
      configurazione.tipologiaSelezionata = null;
      configurazione.stripLedSelezionata = null;
      $('#tipologia-container').hide();
      updateProgressBar(1);
    });
  });
}