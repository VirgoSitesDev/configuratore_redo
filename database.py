from supabase import create_client, Client
import os
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
import logging
from functools import lru_cache
from datetime import datetime, timedelta
import time
import math

load_dotenv()

class DatabaseManager:
    def __init__(self):
        try:
            supabase_url = os.environ.get('SUPABASE_URL')
            supabase_key = os.environ.get('SUPABASE_KEY')
            
            if not supabase_url or not supabase_key:
                raise ValueError("SUPABASE_URL o SUPABASE_KEY non configurati nel file .env")
            
            self.supabase: Client = create_client(supabase_url, supabase_key)
            self._test_connection()
            
        except Exception as e:
            logging.error(f"Errore inizializzazione database: {str(e)}")
            raise
            
        self._cache = {}
        self._cache_timestamps = {}
        self._cache_duration = timedelta(minutes=30)
    
    def _test_connection(self):
        try:
            result = self.supabase.table('categorie').select('id').limit(1).execute()
            logging.info("✓ Connessione a Supabase verificata con successo")
        except Exception as e:
            logging.error(f"✗ Errore connessione Supabase: {str(e)}")
            raise
    
    def _log_query_time(self, query_name: str, start_time: float):
        elapsed = time.time() - start_time
        if elapsed > 1.0:
            logging.warning(f"Query lenta: {query_name} ha impiegato {elapsed:.2f} secondi")
    
    def _get_from_cache(self, key: str) -> Optional[Any]:
        if key in self._cache:
            if datetime.now() - self._cache_timestamps[key] < self._cache_duration:
                return self._cache[key]
            else:
                del self._cache[key]
                del self._cache_timestamps[key]
        return None
    
    def _set_cache(self, key: str, value: Any):
        self._cache[key] = value
        self._cache_timestamps[key] = datetime.now()
    
    def get_categorie(self) -> List[Dict[str, Any]]:
        cache_key = "all_categorie"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        categorie = self.supabase.table('categorie').select('*').execute().data

        sottofamiglie_data = self.supabase.table('categorie_sottofamiglie')\
            .select('categoria_id, sottofamiglia')\
            .execute().data

        sottofamiglie_map = {}
        for sf in sottofamiglie_data:
            cat_id = sf['categoria_id']
            if cat_id not in sottofamiglie_map:
                sottofamiglie_map[cat_id] = []
            sottofamiglie_map[cat_id].append(sf['sottofamiglia'])

        for categoria in categorie:
            categoria['sottofamiglie'] = sottofamiglie_map.get(categoria['id'], [])
        
        self._set_cache(cache_key, categorie)
        return categorie

    def get_profili_by_categoria(self, categoria: str) -> List[Dict[str, Any]]:
        start_time = time.time()

        cache_key = f"profili_categoria_{categoria}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        # Get all profiles from profili_test for this category
        profili_test_data = self.supabase.table('profili_test')\
            .select('*')\
            .eq('categoria', categoria)\
            .execute().data

        if not profili_test_data:
            return []

        # Group by famiglia (profile name) to build unique profiles
        profili_map = {}
        for item in profili_test_data:
            famiglia = item['famiglia']
            if famiglia not in profili_map:
                # Generate image path from famiglia name
                img_path = f"/static/img/{famiglia.lower()}.jpg"

                profili_map[famiglia] = {
                    'id': famiglia,
                    'nome': famiglia,
                    'categoria': item['categoria'],
                    'note': item.get('descrizione'),
                    'finiture': set(),
                    'lunghezze': set(),
                    'due_tagli': item.get('due_tagli', False),  # Track due_tagli flag
                    'immagine': item.get('immagine') or img_path  # Use immagine from profili_test or generate from famiglia (handles empty strings)
                }
            profili_map[famiglia]['finiture'].add(item['finitura'])
            profili_map[famiglia]['lunghezze'].add(item['lunghezza'])
            # Update due_tagli if any variant has it set to True
            if item.get('due_tagli', False):
                profili_map[famiglia]['due_tagli'] = True

        # Build final profili list (no longer need to query profili table for images)
        profili = []
        for famiglia, profilo_data in profili_map.items():

            # Derive tipologie from due_tagli column
            # due_tagli = True -> both "profilo_intero" and "taglio_misura"
            # due_tagli = False -> only "taglio_misura"
            tipologie = ['taglio_misura']
            if profilo_data.get('due_tagli', False):
                tipologie.append('profilo_intero')

            # Get compatible strip IDs for this profile (for frontend tipo selection)
            # Use check_tipo_filter=False to get all compatible strips including SPECIAL types
            compatible_strip_ids = self.get_compatible_strip_ids(famiglia, None, check_tipo_filter=False)

            profilo = {
                'id': profilo_data['id'],
                'nome': profilo_data['nome'],
                'categoria': profilo_data['categoria'],
                'note': profilo_data['note'],
                'immagine': profilo_data['immagine'],  # Generated from famiglia name
                'tipologie': tipologie,
                'finitureDisponibili': sorted(list(profilo_data['finiture'])),
                'lunghezzeDisponibili': sorted(list(profilo_data['lunghezze'])),
                'stripLedCompatibili': compatible_strip_ids  # Calculated based on new compatibility logic
            }

            if profilo['lunghezzeDisponibili']:
                profilo['lunghezzaMassima'] = max(profilo['lunghezzeDisponibili'])
            else:
                profilo['lunghezzaMassima'] = 3000  # Default max length

            profili.append(profilo)

        self._log_query_time(f"get_profili_by_categoria({categoria})", start_time)
        self._set_cache(cache_key, profili)
        return profili

    def get_compatible_strip_ids(self, profilo_id: str, tipologia_strip: Optional[str] = None, check_tipo_filter: bool = True) -> List[str]:
        """
        Get list of compatible strip IDs for a given profile based on new compatibility rules.
        This is used for parameter filtering (tensione, ip, temperatura, etc.)

        Args:
            profilo_id: The profile ID (famiglia)
            tipologia_strip: Optional tipo filter (COB, SMD, SPECIAL, etc.)
            check_tipo_filter: If False, don't apply SPECIAL tipo restrictions (for getting available tipos)
        """
        # Determine if this is an indoor or outdoor profile
        is_outdoor = profilo_id.endswith('PF') or profilo_id.endswith('SK')

        # Get profile width from profili_test (for indoor profiles)
        profilo_larghezza = 0
        if not is_outdoor:
            profilo_test_data = self.supabase.table('profili_test')\
                .select('larghezza')\
                .eq('famiglia', profilo_id)\
                .limit(1)\
                .execute().data

            if profilo_test_data:
                profilo_larghezza = profilo_test_data[0].get('larghezza', 0)

        # Get all strips
        query = self.supabase.table('strip_led').select('id, tipo, nome_commerciale, larghezza')

        if tipologia_strip:
            query = query.eq('tipo', tipologia_strip)

        all_strips = query.execute().data

        if not all_strips:
            return []

        # Apply compatibility filters
        compatible_strip_ids = []

        for strip in all_strips:
            strip_id = strip['id']
            strip_tipo = strip.get('tipo', '')
            strip_nome_commerciale = strip.get('nome_commerciale', '')
            strip_larghezza = strip.get('larghezza', 0)

            is_compatible = False

            if is_outdoor:
                # OUTDOOR COMPATIBILITY LOGIC
                import re
                profile_pattern = re.search(r'(\d+X\d+)', profilo_id)
                profile_dimensions = profile_pattern.group(1) if profile_pattern else None

                # Special case: XFLEX goes only with FWPF
                if 'XFLEX' in strip_nome_commerciale.upper():
                    is_compatible = (profilo_id == 'FWPF')

                # For other outdoor strips, match dimensions in nome_commerciale with profile dimensions
                elif profile_dimensions:
                    strip_pattern = re.search(r'(\d+X\d+)', strip_nome_commerciale.upper())
                    strip_dimensions = strip_pattern.group(1) if strip_pattern else None

                    if strip_dimensions:
                        is_compatible = (strip_dimensions == profile_dimensions)

            else:
                # INDOOR COMPATIBILITY LOGIC
                is_special = (strip_tipo.upper() == 'SPECIAL')
                has_zigzag = 'ZIGZAG' in strip_nome_commerciale.upper()
                # Must be exactly "12X4", not "12X17" or other variations
                has_12x4 = ' 12X4' in (' ' + strip_nome_commerciale.upper()) or strip_nome_commerciale.upper().endswith('12X4')

                # ALWAYS check SPECIAL tipo compatibility for indoor profiles
                # SPECIAL strips are NOT compatible unless they have ZIGZAG or exactly 12X4
                tipo_compatible = (not is_special) or (is_special and (has_zigzag or has_12x4))

                # Check width compatibility
                width_compatible = (strip_larghezza <= profilo_larghezza) if profilo_larghezza > 0 else True

                is_compatible = tipo_compatible and width_compatible

            if is_compatible:
                compatible_strip_ids.append(strip_id)

        return compatible_strip_ids

    def get_strip_led_filtrate(self, profilo_id: str, tensione: str, ip: str,
                            temperatura: str, potenza: Optional[str] = None,
                            tipologia: Optional[str] = None,
                            lunghezza_richiesta: Optional[int] = None) -> List[Dict[str, Any]]:
        logging.info(f"get_strip_led_filtrate chiamata con: profilo_id={profilo_id}, tensione={tensione}, ip={ip}, temperatura={temperatura}, potenza={potenza}, tipologia={tipologia}")

        # Determine if this is an indoor or outdoor profile
        is_outdoor = profilo_id.endswith('PF') or profilo_id.endswith('SK')

        # Get profile width from profili_test (for indoor profiles)
        profilo_larghezza = 0
        if not is_outdoor:
            profilo_test_data = self.supabase.table('profili_test')\
                .select('larghezza')\
                .eq('famiglia', profilo_id)\
                .limit(1)\
                .execute().data

            if profilo_test_data:
                profilo_larghezza = profilo_test_data[0].get('larghezza', 0)
                logging.info(f"Profilo indoor {profilo_id} larghezza: {profilo_larghezza}mm")

        # Get all strips matching basic filters
        query = self.supabase.table('strip_led').select('*')
        query = query.eq('tensione', tensione).eq('ip', ip)

        if tipologia:
            query = query.eq('tipo', tipologia)

        all_strips = query.execute().data

        if not all_strips:
            return []

        # Apply compatibility filters
        compatible_strips = []

        for strip in all_strips:
            strip_id = strip['id']
            strip_tipo = strip.get('tipo', '')
            strip_nome_commerciale = strip.get('nome_commerciale', '')
            strip_larghezza = strip.get('larghezza', 0)

            is_compatible = False

            if is_outdoor:
                # OUTDOOR COMPATIBILITY LOGIC
                # Extract numbers with 'X' from profile codice_listino (e.g., "13X12" from "MG13X12PF")
                import re
                profile_pattern = re.search(r'(\d+X\d+)', profilo_id)
                profile_dimensions = profile_pattern.group(1) if profile_pattern else None

                # Special case: XFLEX goes only with FWPF
                if 'XFLEX' in strip_nome_commerciale.upper():
                    is_compatible = (profilo_id == 'FWPF')
                    logging.info(f"Strip XFLEX compatibility with {profilo_id}: {is_compatible}")

                # For other outdoor strips, match dimensions in nome_commerciale with profile dimensions
                elif profile_dimensions:
                    strip_pattern = re.search(r'(\d+X\d+)', strip_nome_commerciale.upper())
                    strip_dimensions = strip_pattern.group(1) if strip_pattern else None

                    if strip_dimensions:
                        is_compatible = (strip_dimensions == profile_dimensions)
                        logging.info(f"Strip {strip_nome_commerciale} dimensions {strip_dimensions} vs profile {profilo_id} dimensions {profile_dimensions}: {is_compatible}")

            else:
                # INDOOR COMPATIBILITY LOGIC
                # Strips are compatible if:
                # 1. tipo is NOT "SPECIAL"
                # 2. OR tipo is "SPECIAL" but nome_commerciale contains "ZIGZAG" or exactly "12X4"
                # 3. AND strip larghezza <= profile larghezza

                is_special = (strip_tipo.upper() == 'SPECIAL')
                has_zigzag = 'ZIGZAG' in strip_nome_commerciale.upper()
                # Must be exactly "12X4", not "12X17" or other variations
                has_12x4 = ' 12X4' in (' ' + strip_nome_commerciale.upper()) or strip_nome_commerciale.upper().endswith('12X4')

                # Check tipo compatibility
                tipo_compatible = (not is_special) or (is_special and (has_zigzag or has_12x4))

                # Check width compatibility
                width_compatible = (strip_larghezza <= profilo_larghezza) if profilo_larghezza > 0 else True

                is_compatible = tipo_compatible and width_compatible

                logging.info(f"Strip {strip_id} indoor compatibility: tipo={strip_tipo}, special={is_special}, zigzag={has_zigzag}, 12x4={has_12x4}, strip_width={strip_larghezza}, profile_width={profilo_larghezza}, compatible={is_compatible}")

            if is_compatible:
                compatible_strips.append(strip)

        if not compatible_strips:
            logging.warning(f"No compatible strips found for profile {profilo_id}")
            return []

        # Get additional data for compatible strips
        strip_ids = [s['id'] for s in compatible_strips]

        temperature_data = self.supabase.table('strip_temperature')\
            .select('strip_id, temperatura')\
            .in_('strip_id', strip_ids)\
            .execute().data

        potenze_data = self.supabase.table('strip_potenze')\
            .select('strip_id, potenza, codice_prodotto, indice')\
            .in_('strip_id', strip_ids)\
            .order('indice')\
            .execute().data

        temperature_map = {}
        for t in temperature_data:
            sid = t['strip_id']
            if sid not in temperature_map:
                temperature_map[sid] = []
            temperature_map[sid].append(t['temperatura'])

        potenze_map = {}
        codici_map = {}
        for p in potenze_data:
            sid = p['strip_id']
            if sid not in potenze_map:
                potenze_map[sid] = []
                codici_map[sid] = []
            potenze_map[sid].append(p['potenza'])
            codici_map[sid].append(p['codice_prodotto'])

        # Build final result with filtering
        result = []
        for strip in compatible_strips:
            sid = strip['id']
            temp_list = temperature_map.get(sid, [])
            if temperatura not in temp_list:
                continue
            if potenza and potenza not in potenze_map.get(sid, []):
                continue

            # Filter out strips where giuntabile is false and requested length exceeds standard length
            giuntabile = strip.get('giuntabile', True)
            lunghezza_standard_metri = strip.get('lunghezza', 5)
            lunghezza_standard_mm = lunghezza_standard_metri * 1000
            if lunghezza_richiesta and not giuntabile and lunghezza_richiesta > lunghezza_standard_mm:
                logging.info(f"Strip {sid} filtered out: giuntabile=False, lunghezza_richiesta={lunghezza_richiesta}mm > lunghezza_standard={lunghezza_standard_mm}mm")
                continue

            strip['temperaturaColoreDisponibili'] = temp_list
            strip['temperatura'] = temperatura
            strip['potenzeDisponibili'] = potenze_map.get(sid, [])
            strip['codiciProdotto'] = codici_map.get(sid, [])
            strip['nomeCommerciale'] = strip.get('nome_commerciale', '')
            strip['taglioMinimo'] = strip.get('taglio_minimo', {})
            strip['lunghezzaMassima'] = lunghezza_standard_mm
            strip['giuntabile'] = giuntabile

            result.append(strip)

        logging.info(f"Found {len(result)} compatible strips for profile {profilo_id}")
        return result

    def get_all_strip_led_filtrate(self, tensione: str, ip: str, 
                                temperatura: str, potenza: Optional[str] = None,
                                tipologia: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Ottiene tutte le strip LED filtrate per i parametri specificati,
        senza considerare la compatibilità con un profilo specifico.
        Usato per il flusso esterni.
        """

        query = self.supabase.table('strip_led').select('*, lunghezza')
        query = query.eq('tensione', tensione).eq('ip', ip)
        
        if tipologia:
            query = query.eq('tipo', tipologia)
        
        strips = query.execute().data
        
        if not strips:
            return []

        found_strip_ids = [s['id'] for s in strips]

        temperature_data = self.supabase.table('strip_temperature')\
            .select('strip_id, temperatura')\
            .in_('strip_id', found_strip_ids)\
            .execute().data

        potenze_data = self.supabase.table('strip_potenze')\
            .select('strip_id, potenza, codice_prodotto, indice')\
            .in_('strip_id', found_strip_ids)\
            .order('indice')\
            .execute().data

        temperature_map = {}
        for t in temperature_data:
            sid = t['strip_id']
            if sid not in temperature_map:
                temperature_map[sid] = []
            temperature_map[sid].append(t['temperatura'])
        
        potenze_map = {}
        codici_map = {}
        for p in potenze_data:
            sid = p['strip_id']
            if sid not in potenze_map:
                potenze_map[sid] = []
                codici_map[sid] = []
            potenze_map[sid].append(p['potenza'])
            codici_map[sid].append(p['codice_prodotto'])

        result = []
        for strip in strips:
            sid = strip['id']
            temp_list = temperature_map.get(sid, [])
            if temperatura not in temp_list:
                continue
            if potenza and potenza not in potenze_map.get(sid, []):
                continue

            strip['temperaturaColoreDisponibili'] = temp_list
            strip['temperatura'] = temperatura
            strip['potenzeDisponibili'] = potenze_map.get(sid, [])
            strip['codiciProdotto'] = codici_map.get(sid, [])
            strip['nomeCommerciale'] = strip.get('nome_commerciale', '')
            strip['taglioMinimo'] = strip.get('taglio_minimo', {})
            strip['lunghezzaMassima'] = strip.get('lunghezza', 5000)
            strip['giuntabile'] = strip.get('giuntabile', True)

            result.append(strip)
        
        return result

    def get_alimentatori_by_tipo(self, tipo_alimentazione: str, 
                                  tensione: str = '24V') -> List[Dict[str, Any]]:
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

        alimentatori = self.supabase.table('alimentatori')\
            .select('*')\
            .eq('tensione', tensione)\
            .in_('id', alimentatori_ids)\
            .execute().data
        
        if not alimentatori:
            return []

        alim_ids = [a['id'] for a in alimentatori]
        potenze_data = self.supabase.table('alimentatori_potenze')\
            .select('alimentatore_id, potenza, codice')\
            .in_('alimentatore_id', alim_ids)\
            .order('potenza')\
            .execute().data

        potenze_map = {}
        for p in potenze_data:
            aid = p['alimentatore_id']
            if aid not in potenze_map:
                potenze_map[aid] = []
            potenze_map[aid].append(p)

        for alim in alimentatori:
            aid = alim['id']
            potenze_list = potenze_map.get(aid, [])
            alim['potenze'] = [p['potenza'] for p in potenze_list]
            alim['codici'] = {str(p['potenza']): p['codice'] for p in potenze_list if p['codice']}
        
        return alimentatori
    
    def get_potenze_alimentatore(self, alimentatore_id: str) -> List[int]:
        cache_key = f"potenze_alim_{alimentatore_id}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
        
        potenze = self.supabase.table('alimentatori_potenze')\
            .select('potenza')\
            .eq('alimentatore_id', alimentatore_id)\
            .order('potenza')\
            .execute().data
        
        result = [p['potenza'] for p in potenze]
        self._set_cache(cache_key, result)
        return result
    
    def get_dimmer_compatibili(self, strip_id: str) -> Dict[str, Any]:
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

        dimmer_details = self.supabase.table('dimmer')\
            .select('*')\
            .in_('id', dimmer_ids)\
            .execute().data

        dimmer_ids.append('NESSUN_DIMMER')

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
        cache_key = f"dettagli_alim_{alimentatore_id}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        alimentatore = self.supabase.table('alimentatori')\
            .select('*')\
            .eq('id', alimentatore_id)\
            .single()\
            .execute().data
        
        if alimentatore:
            potenze_data = self.supabase.table('alimentatori_potenze')\
                .select('potenza, codice')\
                .eq('alimentatore_id', alimentatore_id)\
                .order('potenza')\
                .execute().data
            
            alimentatore['potenze'] = [p['potenza'] for p in potenze_data]
            alimentatore['codici'] = {str(p['potenza']): p['codice'] for p in potenze_data if p['codice']}
        
        self._set_cache(cache_key, alimentatore)
        return alimentatore
    
    def clear_cache(self):
        self._cache.clear()
        self._cache_timestamps.clear()
        logging.info("Cache cleared")

    def get_prezzo_strip_led(self, codice_completo: str, temperatura: str = None, potenza: str = None) -> float:
        """Ottiene il prezzo di una strip LED basato sul codice completo + temperatura + potenza"""
        try:
            if not codice_completo:
                return 0.0

            query = self.supabase.table('strip_prezzi').select('prezzo_euro')
            query = query.eq('strip_id', codice_completo)

            if temperatura:
                query = query.eq('temperatura', temperatura)
            if potenza:
                query = query.eq('potenza', potenza)
            
            result = query.execute()
            
            if result.data and len(result.data) > 0:
                prezzo = result.data[0].get('prezzo_euro', 0.0)
                return float(prezzo) if prezzo is not None else 0.0
            
            return 0.0
            
        except Exception as e:
            logging.error(f"Errore nel recupero prezzo strip LED {codice_completo}: {str(e)}")
            return 0.0

    def get_prezzo_profilo(self, codice_listino: str, finitura: str = None, lunghezza_mm: int = None) -> float:
        """Ottiene il prezzo di un profilo basato sul codice listino + finitura + lunghezza"""
        try:
            if not codice_listino:
                return 0.0

            codice_listino = codice_listino.split(' ')[0]

            # Use profili_test table - query by codice_listino (primary key)
            # If we have the exact codice_listino, use it directly
            result = self.supabase.table('profili_test')\
                .select('prezzo')\
                .eq('codice_listino', codice_listino)\
                .execute()

            if result.data and len(result.data) > 0:
                prezzo = result.data[0].get('prezzo', 0.0)
                return float(prezzo) if prezzo is not None else 0.0

            # If not found by exact codice_listino, try to find by famiglia + finitura + lunghezza
            if finitura and lunghezza_mm:
                # Extract famiglia from codice_listino (e.g., "PRF005/200" -> "PRF005")
                famiglia = codice_listino.split('/')[0]

                result = self.supabase.table('profili_test')\
                    .select('prezzo')\
                    .eq('famiglia', famiglia)\
                    .eq('finitura', finitura)\
                    .eq('lunghezza', lunghezza_mm)\
                    .execute()

                if result.data and len(result.data) > 0:
                    prezzo = result.data[0].get('prezzo', 0.0)
                    return float(prezzo) if prezzo is not None else 0.0

            # Fallback: try to find by famiglia only (get first match)
            if '/' in codice_listino:
                famiglia = codice_listino.split('/')[0]
                result = self.supabase.table('profili_test')\
                    .select('prezzo')\
                    .eq('famiglia', famiglia)\
                    .limit(1)\
                    .execute()

                if result.data and len(result.data) > 0:
                    prezzo = result.data[0].get('prezzo', 0.0)
                    logging.warning(f"Usando prezzo generico per famiglia {famiglia}: €{prezzo:.2f}")
                    return float(prezzo) if prezzo is not None else 0.0

            logging.warning(f"Nessun prezzo trovato per profilo {codice_listino}")
            return 0.0

        except Exception as e:
            logging.error(f"Errore nel recupero prezzo profilo {codice_listino}: {str(e)}")
            return 0.0

    def get_prezzo_alimentatore(self, codice_alimentatore: str) -> float:
        """Ottiene il prezzo di un alimentatore basato sul codice"""
        try:
            if not codice_alimentatore:
                return 0.0
                
            result = self.supabase.table('alimentatori_potenze')\
                .select('price')\
                .eq('codice', codice_alimentatore)\
                .execute()
            
            if result.data and len(result.data) > 0:
                prezzo = result.data[0].get('price', 0.0)
                return float(prezzo) if prezzo is not None else 0.0
            
            return 0.0
            
        except Exception as e:
            logging.error(f"Errore nel recupero prezzo alimentatore {codice_alimentatore}: {str(e)}")
            return 0.0

    def get_prezzo_dimmer(self, codice_dimmer: str) -> float:
        """Ottiene il prezzo di un dimmer basato sul codice"""
        try:
            if not codice_dimmer:
                return 0.0

            codice_pulito = codice_dimmer.replace(' - ', '').strip()
            if not codice_pulito:
                return 0.0
                
            result = self.supabase.table('dimmer')\
                .select('price')\
                .eq('codice', codice_pulito)\
                .execute()
            
            if result.data and len(result.data) > 0:
                prezzo = result.data[0].get('price', 0.0)
                return float(prezzo) if prezzo is not None else 0.0
            
            return 0.0
            
        except Exception as e:
            logging.error(f"Errore nel recupero prezzo dimmer {codice_dimmer}: {str(e)}")
            return 0.0

    def get_prezzi_configurazione(self, codice_profilo: str, codice_strip: str,
                                codice_alimentatore: str, codice_dimmer: str,
                                finitura_profilo: str = None, lunghezza_profilo: int = None,
                                temperatura_strip: str = None, potenza_strip: str = None,
                                quantita_profilo: int = 1, quantita_strip: int = 1,
                                lunghezze_multiple: dict = None,
                                tappi_selezionati: dict = None, quantita_tappi: int = 0,
                                diffusore_selezionato: dict = None, quantita_diffusore: int = 0) -> Dict[str, float]:
        """Ottiene tutti i prezzi per una configurazione completa con quantità"""
        try:
            # codice_profilo now comes directly from profili_test.codice_listino (already has correct format)
            prezzo_unitario_profilo = self.get_prezzo_profilo(codice_profilo, finitura_profilo, lunghezza_profilo)
            prezzo_unitario_strip = self.get_prezzo_strip_led(codice_strip, temperatura_strip, potenza_strip)
            prezzo_unitario_alimentatore = self.get_prezzo_alimentatore(codice_alimentatore)
            prezzo_unitario_dimmer = self.get_prezzo_dimmer(codice_dimmer)

            lunghezza_totale_mm = 0
            
            if lunghezze_multiple:
                lunghezza_totale_mm = sum(v for v in lunghezze_multiple.values() if v and v > 0)
            elif lunghezza_profilo:
                lunghezza_totale_mm = lunghezza_profilo

            metri_totali = math.ceil(lunghezza_totale_mm / 1000) if lunghezza_totale_mm > 0 else 0

            prezzi = {
                'profilo': prezzo_unitario_profilo * quantita_profilo,
                'strip_led': prezzo_unitario_strip * metri_totali,
                'alimentatore': prezzo_unitario_alimentatore,
                'dimmer': prezzo_unitario_dimmer,
                'tappi': 0.0,
                'diffusore': 0.0
            }
            if tappi_selezionati and quantita_tappi > 0:
                quantita_db = tappi_selezionati.get('quantita', 1)
                num_pezzi = int(quantita_tappi / quantita_db)
                prezzo_unitario_tappo = float(tappi_selezionati.get('prezzo', 0))
                prezzi['tappi'] = prezzo_unitario_tappo * num_pezzi

            if diffusore_selezionato and quantita_diffusore > 0:
                prezzo_unitario_diffusore = float(diffusore_selezionato.get('prezzo', 0))
                prezzi['diffusore'] = prezzo_unitario_diffusore * quantita_diffusore

            prezzi['totale'] = sum(prezzi.values())
            
            logging.info(f"Prezzi calcolati - Profilo: €{prezzi['profilo']:.2f} (€{prezzo_unitario_profilo:.2f} x {quantita_profilo}), Strip: €{prezzi['strip_led']:.2f} (€{prezzo_unitario_strip:.2f} x {metri_totali}m)")
            
            return prezzi
            
        except Exception as e:
            logging.error(f"Errore nel calcolo prezzi configurazione: {str(e)}")
            return {
                'profilo': 0.0,
                'strip_led': 0.0,
                'alimentatore': 0.0,
                'dimmer': 0.0,
                'totale': 0.0
            }

    def get_codice_profilo(self, profilo_id: str, finitura: str = None, lunghezza_mm: int = None) -> str:
        """Ottiene il codice listino di un profilo dalla tabella profili_test"""
        try:
            if not profilo_id:
                logging.warning("get_codice_profilo chiamato senza profilo_id")
                return ""

            # Query profili_test table for codice_listino
            query = self.supabase.table('profili_test').select('codice_listino')
            query = query.eq('famiglia', profilo_id)

            if finitura:
                query = query.eq('finitura', finitura)
            if lunghezza_mm:
                query = query.eq('lunghezza', int(lunghezza_mm))

            result = query.execute()

            if result.data and len(result.data) > 0:
                codice = result.data[0].get('codice_listino', '')
                if codice:
                    return str(codice)

            # If not found, log warning with details
            logging.warning(
                f"Codice profilo non trovato in profili_test: "
                f"famiglia={profilo_id}, finitura={finitura}, lunghezza={lunghezza_mm}mm"
            )
            return ""

        except Exception as e:
            logging.error(f"Errore nel recupero codice profilo {profilo_id}: {str(e)}")
            return ""

    def get_codice_strip_led(self, strip_id: str, temperatura: str = None, potenza: str = None) -> str:
        """Ottiene il codice completo di una strip LED basato su strip_id, temperatura e potenza"""
        try:
            if not strip_id:
                return ""

            query = self.supabase.table('strip_prezzi').select('codice_completo')
            query = query.eq('strip_id', strip_id)

            if temperatura:
                query = query.eq('temperatura', temperatura)
            if potenza:
                query = query.eq('potenza', potenza)
            
            result = query.execute()
            
            if result.data and len(result.data) > 0:
                codice = result.data[0].get('codice_completo', '')
                return str(codice) if codice is not None else ""
            
            return ""
            
        except Exception as e:
            logging.error(f"Errore nel recupero codice strip LED {strip_id}: {str(e)}")
            return ""