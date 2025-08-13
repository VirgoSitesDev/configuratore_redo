import { calcolaCodiceProdottoCompleto } from './codici_prodotto.js'

export function generaPDF(codiceProdotto, configurazione) {
	if (typeof jspdf === 'undefined') {
	  const script1 = document.createElement('script');
	  script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
	  script1.onload = function() {
		const script2 = document.createElement('script');
		script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js';
		script2.onload = function() {
		  generaPDFContenuto(codiceProdotto, configurazione);
		};
		document.head.appendChild(script2);
	  };
	  document.head.appendChild(script1);
	} else {
	  generaPDFContenuto(codiceProdotto, configurazione);
	}
  }

// Modifiche alla funzione generaPDFContenuto in pdf.js per includere le quantità

function generaPDFContenuto(codiceProdotto, configurazione) {
	try {
	  const tuttiCodici = calcolaCodiceProdottoCompleto();
	  const { jsPDF } = window.jspdf;
	  const doc = new jsPDF({
		orientation: 'portrait',
		unit: 'mm',
		format: 'a4'
	  });
  
	  doc.setFont('helvetica', 'bold');
	  doc.setFontSize(20);
	  doc.text('Riepilogo della configurazione', 105, 20, { align: 'center' });
  
	  try {
		const logoImg = new Image();
		logoImg.src = '/static/img/logo-redo-nero.png';
		doc.addImage(logoImg, 'PNG', 15, 10, 30, 15);
	  } catch (e) {
		console.warn('Logo non disponibile');
	  }
  
	  doc.setFontSize(14);
	  doc.text(`Codice prodotto: ${codiceProdotto}`, 15, 35);
  
	  const dataOggi = new Date().toLocaleDateString('it-IT');
	  doc.setFontSize(10);
	  doc.text(`Data: ${dataOggi}`, 195, 20, { align: 'right' });
  
	  const mappaNomi = {
		// Categorie
		'nanoprofili': 'Nanoprofili',
		'incasso': 'Profili a Incasso',
		'sospensione': 'Profili a Sospensione',
		'plafone': 'Profili a Plafone',
		'parete': 'Profili a Parete',
		'particolari': 'Profili Particolari',
		'scalino': 'Profili a Scalino',
		'wall_washer': 'Profili Wallwasher',
		
		// Tipologie
		'taglio_misura': 'Taglio su misura',
		'profilo_intero': 'Profilo intero',
		
		// Forme di taglio
		'DRITTO_SEMPLICE': 'Dritto semplice',
		'FORMA_L_DX': 'Forma a L DX',
		'FORMA_L_SX': 'Forma a L SX',
		'FORMA_C': 'Forma a C',
		'RETTANGOLO_QUADRATO': 'Rettangolo/Quadrato',
		
		// Finiture
		'ALLUMINIO_ANODIZZATO': 'Alluminio anodizzato',
		'BIANCO': 'Bianco',
		'NERO': 'Nero',
		'ALLUMINIO': 'Alluminio',
		
		// Alimentazione
		'ON-OFF': 'ON/OFF',
		'DIMMERABILE_TRIAC': 'Dimmerabile TRIAC',
		'SENZA_ALIMENTATORE': 'Senza alimentatore',
		
		// Dimmer
		'NESSUN_DIMMER': 'Nessun dimmer',
		'TOUCH_SU_PROFILO': 'Touch su profilo',
		'CON_TELECOMANDO': 'Con telecomando',
		'CENTRALINA_TUYA': 'Centralina TUYA',
		'DIMMER_A_PULSANTE_SEMPLICE': 'Dimmer a pulsante semplice',
		
		// Alimentazione cavo
		'ALIMENTAZIONE_UNICA': 'Alimentazione unica',
		'ALIMENTAZIONE_DOPPIA': 'Alimentazione doppia',
		
		// Uscita cavo
		'DRITTA': 'Dritta',
		'LATERALE_DX': 'Laterale destra',
		'LATERALE_SX': 'Laterale sinistra',
		'RETRO': 'Retro'
	  };
  
	  const getNomeVisualizzabile = (codice) => {
		return mappaNomi[codice] || codice;
	  };
  
	  const datiTabella = [];
  
		if (configurazione.categoriaSelezionata) {
			datiTabella.push(['Categoria', getNomeVisualizzabile(configurazione.categoriaSelezionata)]);
		}

		// ✅ NUOVO: Funzione per generare testo modello PDF ottimizzato
		function generaTestoModelloPDF() {
		if (!configurazione.combinazioneProfiloOttimale || configurazione.combinazioneProfiloOttimale.length === 0) {
			let modelloText = (configurazione.nomeModello || codiceProdotto);
			if (tuttiCodici && tuttiCodici.profilo) {
			modelloText += ' - ' + tuttiCodici.profilo;
			}
			return modelloText;
		}
		
		if (configurazione.combinazioneProfiloOttimale.length === 1) {
			const combo = configurazione.combinazioneProfiloOttimale[0];
			let modelloText = (configurazione.nomeModello || codiceProdotto);
			
			if (combo.quantita > 1) {
			modelloText = `${combo.quantita}x ${modelloText} (${combo.lunghezza}mm cad.)`;
			}
			
			if (tuttiCodici && tuttiCodici.profilo) {
			modelloText += ' - ' + tuttiCodici.profilo;
			}
			
			return modelloText;
		}
		
		// Multiple lunghezze
		const parti = configurazione.combinazioneProfiloOttimale.map(combo => {
			let codiceProfilo = '';
			
			// Genera codice specifico per questa lunghezza
			if (configurazione.finituraSelezionata && configurazione.profiloSelezionato) {
			const profiloBase = configurazione.profiloSelezionato;
			const lunghezzaInCm = combo.lunghezza / 10;
			
			let colorCode = '';
			if (configurazione.finituraSelezionata === "NERO") colorCode = 'BK';
			else if (configurazione.finituraSelezionata === "BIANCO") colorCode = 'WH';
			else if (configurazione.finituraSelezionata === "ALLUMINIO") colorCode = 'AL';
			
			// Logica per codici speciali basata sui profili
			const isOpqProfile = ["PRF120_300", "PRF080_200"].includes(profiloBase);
			const isSabProfile = ["PRF016_200SET", "PRF011_300"].includes(profiloBase);
			const isAl = (profiloBase.includes("PRFIT") || profiloBase.includes("PRF120")) && !profiloBase.includes("PRFIT321");
			const isSpecialProfile = ["FWPF", "MG13X12PF", "MG12X17PF", "SNK6X12PF", "SNK10X10PF", "SNK12X20PF"].includes(profiloBase);
			
			if (isSpecialProfile) {
				codiceProfilo = profiloBase.replace(/_/g, '/');
			} else {
				if (isOpqProfile) colorCode = "M" + colorCode;
				else if (isSabProfile) colorCode = "S" + colorCode;
				
				const profiloFormattato = profiloBase.replace(/_/g, '/').replace(/\/\d+/, `/${lunghezzaInCm}`);
				codiceProfilo = colorCode ? `${profiloFormattato} ${colorCode}` : profiloFormattato;
			}
			}
			
			return `${combo.quantita}x ${configurazione.nomeModello || codiceProdotto} (${combo.lunghezza}mm cad.)${codiceProfilo ? ' - ' + codiceProfilo : ''}`;
		});
		
		return parti.join(' + ');
		}

		const modelloText = generaTestoModelloPDF();
		datiTabella.push(['Modello', modelloText]);
  
	  if (configurazione.tipologiaSelezionata) {
		datiTabella.push(['Tipologia', getNomeVisualizzabile(configurazione.tipologiaSelezionata)]);
	  }
  
	  if (configurazione.lunghezzaRichiesta) {
		datiTabella.push(['Lunghezza richiesta', `${configurazione.lunghezzaRichiesta}mm`]);
	  }
  
	  if (configurazione.stripLedSelezionata && configurazione.stripLedSelezionata !== 'NO_STRIP' && configurazione.includeStripLed !== false) {
		let stripText = (configurazione.nomeCommercialeStripLed || configurazione.stripLedSelezionata);
		if (configurazione.quantitaStripLed > 1) {
		  stripText = `${configurazione.quantitaStripLed}x ${stripText} (${configurazione.lunghezzaMassimaStripLed * 1000}mm cad.)`;
		}
		if (tuttiCodici && tuttiCodici.stripLed) {
		  stripText += ' - ' + tuttiCodici.stripLed;
		}
		
		datiTabella.push(['Strip LED', stripText]);
		
		if (configurazione.tipologiaStripSelezionata) {
		  let tipologiaText = configurazione.tipologiaStripSelezionata;
		  if (configurazione.tipologiaStripSelezionata === 'COB') {
			tipologiaText = 'COB (Chip On Board)';
		  } else if (configurazione.tipologiaStripSelezionata === 'SMD') {
			tipologiaText = 'SMD (Surface Mount Device)';
		  }
		  datiTabella.push(['Tipologia Strip', tipologiaText]);
		}
  
		if (configurazione.potenzaSelezionata) {
		  datiTabella.push(['Potenza', configurazione.potenzaSelezionata]);
		}
	  } else {
		datiTabella.push(['Strip LED', 'Senza Strip LED']);
	  }
  
	  if (configurazione.tensioneSelezionato === '220V') {
		datiTabella.push(['Alimentazione', 'Strip 220V (no alimentatore)']);
	  } else if (configurazione.alimentazioneSelezionata) {
		datiTabella.push(['Alimentazione', getNomeVisualizzabile(configurazione.alimentazioneSelezionata), tuttiCodici.alimentatore]);
	  }
  
	  if (configurazione.tipologiaAlimentatoreSelezionata && 
		  configurazione.alimentazioneSelezionata !== 'SENZA_ALIMENTATORE' &&
		  configurazione.tensioneSelezionato !== '220V') {
		datiTabella.push(['Alimentatore', configurazione.tipologiaAlimentatoreSelezionata, tuttiCodici.alimentatore]);
	  }
  
	  if (configurazione.potenzaConsigliataAlimentatore && 
		  configurazione.tensioneSelezionato !== '220V') {
		datiTabella.push(['Potenza consigliata', `${configurazione.potenzaConsigliataAlimentatore}W`]);
	  }
  
	  if (configurazione.dimmerSelezionato) {
		if (configurazione.tensioneSelezionato === '220V' && configurazione.dimmerSelezionato === 'DIMMER_A_PULSANTE_SEMPLICE') {
		  datiTabella.push(['Dimmer', 'CTR130 - Dimmerabile TRIAC tramite pulsante e sistema TUYA']);
		} else {
		  datiTabella.push(['Dimmer', getNomeVisualizzabile(configurazione.dimmerSelezionato).replace(/_/g, ' '), tuttiCodici.dimmer]);
		}
	  }
  
	  if (configurazione.tipoAlimentazioneCavo) {
		datiTabella.push(['Alimentazione cavo', getNomeVisualizzabile(configurazione.tipoAlimentazioneCavo)]);
	  }
  
	  if (configurazione.lunghezzaCavoIngresso) {
		datiTabella.push(['Lunghezza cavo ingresso', `${configurazione.lunghezzaCavoIngresso}mm`]);
	  }
  
	  if (configurazione.tipoAlimentazioneCavo === 'ALIMENTAZIONE_DOPPIA' && configurazione.lunghezzaCavoUscita) {
		datiTabella.push(['Lunghezza cavo uscita', `${configurazione.lunghezzaCavoUscita}mm`]);
	  }
  
	  if (configurazione.uscitaCavoSelezionata && configurazione.categoriaSelezionata != "esterni" && configurazione.categoriaSelezionata != "wall_washer_ext") {
		datiTabella.push(['Uscita cavo', getNomeVisualizzabile(configurazione.uscitaCavoSelezionata)]);
	  }
  
	  if (configurazione.formaDiTaglioSelezionata) {
		datiTabella.push(['Forma di taglio', getNomeVisualizzabile(configurazione.formaDiTaglioSelezionata)]);
	  }
  
	  if (configurazione.finituraSelezionata) {
		datiTabella.push(['Finitura', getNomeVisualizzabile(configurazione.finituraSelezionata)]);
	  }
  
	  if (configurazione.lunghezzeMultiple && Object.keys(configurazione.lunghezzeMultiple).length > 0) {
		Object.entries(configurazione.lunghezzeMultiple).forEach(([lato, valore]) => {
		  if (!valore) return;
		  
		  let etichetta = '';
		  if (configurazione.formaDiTaglioSelezionata === 'FORMA_L_DX' || configurazione.formaDiTaglioSelezionata === 'FORMA_L_SX') {
			etichetta = lato === 'lato1' ? 'Lato orizzontale' : 'Lato verticale';
		  } else if (configurazione.formaDiTaglioSelezionata === 'FORMA_C') {
			if (lato === 'lato1') etichetta = 'Lato orizzontale superiore';
			else if (lato === 'lato2') etichetta = 'Lato verticale';
			else if (lato === 'lato3') etichetta = 'Lato orizzontale inferiore';
		  } else if (configurazione.formaDiTaglioSelezionata === 'RETTANGOLO_QUADRATO') {
			etichetta = lato === 'lato1' ? 'Lunghezza' : 'Larghezza';
		  }
		  
		  datiTabella.push([etichetta, `${valore}mm`]);
		});
	  }

	  if (configurazione.lunghezzaTotale > 0) {
		datiTabella.push(['Lunghezza totale', `${configurazione.lunghezzaTotale}mm`]);
	  }
  
	  if (configurazione.potenzaTotale) {
		datiTabella.push(['Potenza totale', `${configurazione.potenzaTotale}W`]);
	  }
  
	  doc.autoTable({
		startY: 45,
		head: [['Parametro', 'Valore']],
		body: datiTabella,
		theme: 'grid',
		headStyles: { 
		  fillColor: [232, 63, 52],
		  textColor: [255, 255, 255],
		  fontSize: 12,
		  fontStyle: 'bold',
		  halign: 'left',
		  cellPadding: 3
		},
		styles: {
		  fontSize: 10,
		  cellPadding: 2,
		  overflow: 'linebreak',
		  halign: 'left'
		},
		alternateRowStyles: {
		  fillColor: [245, 245, 245]
		},
		columnStyles: {
		  0: { fontStyle: 'bold', cellWidth: 60 },
		  1: { cellWidth: 'auto' }
		},
		margin: { top: 45, right: 15, bottom: 15, left: 15 }
	  });
  
	  const finalY = doc.lastAutoTable.finalY + 10;
	  doc.setFontSize(10);
	  doc.setFont('helvetica', 'normal');
  
	  if (configurazione.categoriaSelezionata === 'esterni' || configurazione.categoriaSelezionata === 'wall_washer_ext') {
	  doc.text('ATTENZIONE: la lunghezza richiesta fa riferimento alla strip led esclusa di tappi e il profilo risulterà leggermente più corto.', 15, finalY);
	  }
  
	  doc.setFont('helvetica', 'bold');
	  doc.setTextColor(194, 59, 34);
	  doc.text('ATTENZIONE: eventuali staffe aggiuntive non incluse.', 15, finalY + 8);
	  doc.setTextColor(0, 0, 0);
	  doc.setFont('helvetica', 'normal');
	  
	  doc.setFontSize(8);
	  doc.text('REDO Srl - Configuratore Profili LED', 105, 285, { align: 'center' });
  
	  const filename = `configurazione_${codiceProdotto}_${Date.now()}.pdf`;
	  doc.save(filename);
	  
	} catch (error) {
	  console.error("Errore nella generazione del PDF:", error);
	  alert("Si è verificato un errore nella generazione del PDF. Riprova più tardi.");
	}
  }