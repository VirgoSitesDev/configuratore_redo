# database.py
from supabase import create_client, Client
import os
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Carica le variabili d'ambiente dal file .env
load_dotenv()

class DatabaseManager:
    def __init__(self):
        self.supabase: Client = create_client(
            os.environ.get('SUPABASE_URL'),
            os.environ.get('SUPABASE_KEY')
        )
    
    def get_categorie(self) -> List[Dict[str, Any]]:
        """Ottiene tutte le categorie con le loro sottofamiglie"""
        # Prendi le categorie
        categorie = self.supabase.table('categorie').select('*').execute().data
        
        # Per ogni categoria, prendi le sottofamiglie
        for categoria in categorie:
            sottofamiglie = self.supabase.table('categorie_sottofamiglie')\
                .select('sottofamiglia')\
                .eq('categoria_id', categoria['id'])\
                .execute().data
            
            categoria['sottofamiglie'] = [s['sottofamiglia'] for s in sottofamiglie]
        
        return categorie
    
    def get_profili_by_categoria(self, categoria: str) -> List[Dict[str, Any]]:
        """Ottiene i profili di una categoria specifica"""
        # Prendi i profili base
        profili = self.supabase.table('profili')\
            .select('*')\
            .eq('categoria', categoria)\
            .execute().data
        
        # Per ogni profilo, prendi i dati correlati
        for profilo in profili:
            # Tipologie
            tipologie = self.supabase.table('profili_tipologie')\
                .select('tipologia')\
                .eq('profilo_id', profilo['id'])\
                .execute().data
            profilo['tipologie'] = [t['tipologia'] for t in tipologie]
            
            # Finiture
            finiture = self.supabase.table('profili_finiture')\
                .select('finitura')\
                .eq('profilo_id', profilo['id'])\
                .execute().data
            profilo['finitureDisponibili'] = [f['finitura'] for f in finiture]
            
            # Lunghezze
            lunghezze = self.supabase.table('profili_lunghezze')\
                .select('lunghezza')\
                .eq('profilo_id', profilo['id'])\
                .order('lunghezza')\
                .execute().data
            profilo['lunghezzeDisponibili'] = [l['lunghezza'] for l in lunghezze]
            
            # Strip compatibili
            strip_compatibili = self.supabase.table('profili_strip_compatibili')\
                .select('strip_id')\
                .eq('profilo_id', profilo['id'])\
                .execute().data
            profilo['stripLedCompatibili'] = [s['strip_id'] for s in strip_compatibili]
            
            # Campi aggiuntivi per compatibilità
            profilo['lunghezzaMassima'] = profilo.get('lunghezza_massima', 3000)
        
        return profili
    
    def get_strip_led_filtrate(self, profilo_id: str, tensione: str, ip: str, 
                               temperatura: str, potenza: Optional[str] = None,
                               tipologia: Optional[str] = None) -> List[Dict[str, Any]]:
        """Ottiene le strip LED filtrate per i parametri specificati"""
        # Prima ottieni le strip compatibili con il profilo
        strip_compatibili = self.supabase.table('profili_strip_compatibili')\
            .select('strip_id')\
            .eq('profilo_id', profilo_id)\
            .execute().data
        
        strip_ids = [s['strip_id'] for s in strip_compatibili]
        
        if not strip_ids:
            return []
        
        # Query base per le strip
        query = self.supabase.table('strip_led').select('*')
        
        # Filtra per tensione e IP
        query = query.eq('tensione', tensione).eq('ip', ip)
        
        # Se specificato, filtra per tipo
        if tipologia:
            query = query.eq('tipo', tipologia)
        
        # Esegui la query
        strips = query.in_('id', strip_ids).execute().data
        
        # Filtra ulteriormente per temperatura e potenza
        result = []
        for strip in strips:
            # Verifica temperatura
            temperature = self.supabase.table('strip_temperature')\
                .select('temperatura')\
                .eq('strip_id', strip['id'])\
                .execute().data
            
            temp_list = [t['temperatura'] for t in temperature]
            if temperatura not in temp_list:
                continue
            
            # Se specificata potenza, verifica anche quella
            if potenza:
                potenze = self.supabase.table('strip_potenze')\
                    .select('potenza, codice_prodotto')\
                    .eq('strip_id', strip['id'])\
                    .order('indice')\
                    .execute().data
                
                potenze_list = [p['potenza'] for p in potenze]
                if potenza not in potenze_list:
                    continue
                
                # Aggiungi info potenze alla strip
                strip['potenzeDisponibili'] = potenze_list
                strip['codiciProdotto'] = [p['codice_prodotto'] for p in potenze]
            else:
                # Se non è specificata la potenza, carica tutte le potenze disponibili
                potenze = self.supabase.table('strip_potenze')\
                    .select('potenza, codice_prodotto')\
                    .eq('strip_id', strip['id'])\
                    .order('indice')\
                    .execute().data
                
                strip['potenzeDisponibili'] = [p['potenza'] for p in potenze]
                strip['codiciProdotto'] = [p['codice_prodotto'] for p in potenze]
            
            # Aggiungi temperature alla strip
            strip['temperaturaColoreDisponibili'] = temp_list
            strip['temperatura'] = temperatura
            
            # Aggiungi campi per compatibilità
            strip['nomeCommerciale'] = strip.get('nome_commerciale', '')
            strip['taglioMinimo'] = strip.get('taglio_minimo', {})
            
            result.append(strip)
        
        return result
    
    def get_alimentatori_by_tipo(self, tipo_alimentazione: str, 
                                  tensione: str = '24V') -> List[Dict[str, Any]]:
        """Ottiene gli alimentatori per tipo e tensione"""
        # Mappa i tipi di alimentazione agli ID degli alimentatori
        alimentatori_map = {
            'ON-OFF': ['SERIE_AT24', 'SERIE_ATUS', 'SERIE_ATSIP44', 
                       'SERIE_AT24IP67', 'SERIE_ATN24IP67'],
            'DIMMERABILE_TRIAC': ['SERIE_ATD24', 'SERIE_ATD24IP67']
        }
        
        if tensione == '48V':
            alimentatori_map['ON-OFF'] = ['SERIE_ATS48IP44']
        
        alimentatori_ids = alimentatori_map.get(tipo_alimentazione, [])
        
        if not alimentatori_ids:
            return []
        
        # Query alimentatori
        alimentatori = self.supabase.table('alimentatori')\
            .select('*')\
            .eq('tensione', tensione)\
            .in_('id', alimentatori_ids)\
            .execute().data
        
        # Aggiungi info potenze per ogni alimentatore
        for alim in alimentatori:
            potenze_data = self.supabase.table('alimentatori_potenze')\
                .select('potenza, codice')\
                .eq('alimentatore_id', alim['id'])\
                .order('potenza')\
                .execute().data
            
            alim['potenze'] = [p['potenza'] for p in potenze_data]
            alim['codici'] = {str(p['potenza']): p['codice'] for p in potenze_data if p['codice']}
        
        return alimentatori
    
    def get_potenze_alimentatore(self, alimentatore_id: str) -> List[int]:
        """Ottiene le potenze disponibili per un alimentatore"""
        potenze = self.supabase.table('alimentatori_potenze')\
            .select('potenza, codice')\
            .eq('alimentatore_id', alimentatore_id)\
            .order('potenza')\
            .execute().data
        
        return [p['potenza'] for p in potenze]
    
    def get_dimmer_compatibili(self, strip_id: str) -> Dict[str, Any]:
        """Ottiene i dimmer compatibili con una strip LED"""
        # Prima ottieni tutti i dimmer che sono compatibili con questa strip
        compatibilita = self.supabase.table('dimmer_strip_compatibili')\
            .select('dimmer_id')\
            .eq('strip_id', strip_id)\
            .execute().data
        
        dimmer_ids = [c['dimmer_id'] for c in compatibilita]
        
        if not dimmer_ids:
            return {
                'success': True,
                'opzioni': ['NESSUN_DIMMER'],
                'nomiDimmer': {'NESSUN_DIMMER': 'Nessun dimmer'},
                'codiciDimmer': {},
                'spaziNonIlluminati': {},
                'potenzeMassime': {}
            }
        
        # Aggiungi sempre l'opzione NESSUN_DIMMER
        dimmer_ids.append('NESSUN_DIMMER')
        
        # Ottieni i dettagli dei dimmer
        dimmer_details = self.supabase.table('dimmer')\
            .select('*')\
            .in_('id', dimmer_ids)\
            .execute().data
        
        # Costruisci la risposta
        result = {
            'success': True,
            'opzioni': dimmer_ids,
            'nomiDimmer': {'NESSUN_DIMMER': 'Nessun dimmer'},
            'codiciDimmer': {},
            'spaziNonIlluminati': {},
            'potenzeMassime': {'NESSUN_DIMMER': 9999}
        }
        
        for dimmer in dimmer_details:
            result['nomiDimmer'][dimmer['id']] = dimmer['nome']
            if dimmer['codice']:
                result['codiciDimmer'][dimmer['id']] = dimmer['codice']
            if dimmer['spazio_non_illuminato']:
                result['spaziNonIlluminati'][dimmer['id']] = dimmer['spazio_non_illuminato']
            if dimmer['potenza_massima']:
                result['potenzeMassime'][dimmer['id']] = dimmer['potenza_massima']
        
        return result
    
    def salva_configurazione(self, configurazione: Dict[str, Any], 
                            codice_prodotto: str,
                            email: Optional[str] = None,
                            telefono: Optional[str] = None,
                            note: Optional[str] = None) -> Dict[str, Any]:
        """Salva una configurazione completata"""
        data = {
            'codice_prodotto': codice_prodotto,
            'configurazione': configurazione,
            'email': email,
            'telefono': telefono,
            'note': note
        }
        
        result = self.supabase.table('configurazioni_salvate').insert(data).execute()
        
        return result.data[0] if result.data else None
    
    def get_dettagli_alimentatore(self, alimentatore_id: str) -> Dict[str, Any]:
        """Ottiene i dettagli di un alimentatore specifico"""
        # Prendi l'alimentatore
        alimentatore = self.supabase.table('alimentatori')\
            .select('*')\
            .eq('id', alimentatore_id)\
            .single()\
            .execute().data
        
        if alimentatore:
            # Aggiungi le potenze
            potenze_data = self.supabase.table('alimentatori_potenze')\
                .select('potenza, codice')\
                .eq('alimentatore_id', alimentatore_id)\
                .order('potenza')\
                .execute().data
            
            alimentatore['potenze'] = [p['potenza'] for p in potenze_data]
            alimentatore['codici'] = {str(p['potenza']): p['codice'] for p in potenze_data if p['codice']}
        
        return alimentatore