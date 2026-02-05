/**
 * LinkedIn Gender Cloud - Lia 360
 * Gender inference based on first names.
 */
(function () {
    'use strict';

    console.log('[Lia 360] Loading Gender module...');

    // Compressed dictionary to save space while maintaining high coverage
    // Format: "name": "m" (male) or "f" (female)
    // Focused on Brazil, US, UK, Spain, LATAM
    const GENDER_DB = {
        // Male Names
        "joao": "m", "jose": "m", "carlos": "m", "pedro": "m", "paulo": "m", "lucas": "m", "marcos": "m", "rafael": "m",
        "bruno": "m", "diego": "m", "thiago": "m", "tiago": "m", "gustavo": "m", "andre": "m", "marcelo": "m",
        "rodrigo": "m", "felipe": "m", "leandro": "m", "alex": "m", "alexandre": "m", "guilherme": "m", "fernando": "m",
        "ricardo": "m", "roberto": "m", "daniel": "m", "flavio": "m", "eduardo": "m", "matheus": "m", "leonardo": "m",
        "gabriel": "m", "vinicius": "m", "luiz": "m", "luis": "m", "antonio": "m", "francisco": "m", "raimundo": "m",
        "sergio": "m", "vitor": "m", "victor": "m", "luciano": "m", "claudio": "m", "adrian": "m", "adriano": "m",
        "julio": "m", "cesar": "m", "fabio": "m", "fagner": "m", "renato": "m", "rogerio": "m", "marcio": "m",
        "murilo": "m", "henrique": "m", "caio": "m", "hugo": "m", "igor": "m", "samuel": "m", "willian": "m",
        "william": "m", "david": "m", "davi": "m", "arthur": "m", "artur": "m", "bernardo": "m", "heitor": "m",
        "miguel": "m", "theodoro": "m", "theo": "m", "enzo": "m", "lorenzo": "m", "benicio": "m", "benjamin": "m",
        "isaac": "m", "nicolas": "m", "joaquim": "m", "manuel": "m", "manoel": "m", "gilberto": "m", "jurandir": "m",
        "adipson": "m", "adilson": "m", "edson": "m", "milton": "m", "nilton": "m", "walter": "m", "valter": "m",
        "wanderley": "m", "vanderlei": "m", "wesley": "m", "wellington": "m", "washington": "m", "robson": "m",
        "anderson": "m", "jefferson": "m", "hudson": "m", "everton": "m", "cleber": "m", "kleber": "m", "gilmar": "m",
        "gilson": "m", "edmilson": "m", "jailson": "m", "jair": "m", "osmar": "m", "osvaldo": "m", "valdir": "m",
        "silvio": "m", "celso": "m", "reginaldo": "m", "reinaldo": "m", "ronaldo": "m", "rivaldo": "m", "romario": "m",
        "breno": "m", "reno": "m", "caue": "m", "ian": "m", "yan": "m", "kaique": "m", "kaua": "m",
        "tales": "m", "thales": "m", "tomas": "m", "thomas": "m", "nathan": "m", "jonathan": "m", "jonatas": "m",
        "elias": "m", "israel": "m", "abner": "m", "abraao": "m", "adao": "m", "noah": "m", "calebe": "m", "josue": "m",
        "jorge": "m", "mateus": "m", "otavio": "m", "august": "m", "augusto": "m", "benedito": "m", "vicente": "m",
        "diogo": "m", "douglas": "m", "fabricio": "m", "mauro": "m", "saulo": "m", "ulisses": "m", "vincent": "m",
        "james": "m", "john": "m", "robert": "m", "michael": "m", "will": "m", "richard": "m",
        "joseph": "m", "charles": "m", "christopher": "m", "paul": "m", "mark": "m",
        "donald": "m", "george": "m", "kenneth": "m", "steven": "m", "edward": "m", "brian": "m", "ronald": "m",
        "anthony": "m", "kevin": "m", "jason": "m", "matthew": "m", "gary": "m", "timothy": "m",
        "larry": "m", "jeffrey": "m", "frank": "m", "scott": "m", "eric": "m", "stephen": "m", "andrew": "m",
        "raymond": "m", "gregory": "m", "joshua": "m", "jerry": "m", "dennis": "m", "patrick": "m",
        "peter": "m", "harold": "m", "henry": "m", "carl": "m", "ryan": "m", "roger": "m",
        "juan": "m", "jack": "m", "albert": "m", "justin": "m", "terry": "m", "gerald": "m",
        "keith": "m", "willie": "m", "ralph": "m", "lawrence": "m", "nicholas": "m", "roy": "m",
        "bruce": "m", "brandon": "m", "adam": "m", "harry": "m", "fred": "m", "wayne": "m",
        "billy": "m", "steve": "m", "louis": "m", "jeremy": "m", "aaron": "m", "randy": "m", "howard": "m",
        "eugene": "m", "russell": "m", "bobby": "m", "martin": "m", "ernest": "m",
        "phillip": "m", "todd": "m", "jesse": "m", "craig": "m", "alan": "m", "shawn": "m", "clarence": "m",
        "sean": "m", "philip": "m", "chris": "m", "johnny": "m", "earl": "m", "jimmy": "m",

        // Female Names
        "maria": "f", "ana": "f", "carla": "f", "paula": "f", "julia": "f", "juliana": "f", "camila": "f",
        "bruna": "f", "amanda": "f", "beatriz": "f", "larissa": "f", "jessica": "f", "mariana": "f",
        "fernanda": "f", "patricia": "f", "leticia": "f", "gabriela": "f", "vanessa": "f", "sabrina": "f",
        "renata": "f", "daniela": "f", "carolina": "f", "andrea": "f", "adriana": "f", "claudia": "f",
        "natalia": "f", "bianca": "f", "tatiana": "f", "priscila": "f", "aline": "f", "roberta": "f",
        "thais": "f", "taisc": "f", "thays": "f", "lais": "f", "aysha": "f", "alice": "f", "sophia": "f",
        "sofia": "f", "helena": "f", "laura": "f", "manuela": "f", "manoela": "f", "valentina": "f",
        "luiza": "f", "luisa": "f", "isabella": "f", "isabela": "f", "heloisa": "f", "heloiza": "f",
        "cecilia": "f", "maite": "f", "elisa": "f", "liz": "f", "livia": "f", "antonella": "f", "lorena": "f",
        "melissa": "f", "yasmin": "f", "marina": "f", "rebeca": "f", "agatha": "f", "ester": "f", "catarina": "f",
        "lavinia": "f", "olivia": "f", "alicia": "f", "vitoria": "f", "victoria": "f", "emanuelly": "f",
        "manuelly": "f", "clara": "f", "clarice": "f", "marcia": "f", "sonia": "f", "regina": "f", "fatima": "f",
        "vera": "f", "sandr": "f", "sandra": "f", "sueli": "f", "silvia": "f", "sylvia": "f", "cristina": "f",
        "cristiane": "f", "cristiana": "f", "rosana": "f", "rosangela": "f", "rose": "f", "roseli": "f",
        "simone": "f", "solange": "f", "valeria": "f", "viviane": "f", "elaine": "f", "eliane": "f",
        "edna": "f", "elza": "f", "terezinha": "f", "tereza": "f", "neusa": "f", "neuza": "f", "marta": "f",
        "glaucia": "f", "kelly": "f", "keli": "f", "michele": "f", "michelle": "f", "monica": "f",
        "alessandra": "f", "denise": "f", "debora": "f", "deborah": "f", "priscilla": "f", "cintia": "f",
        "cynthia": "f", "jaqueline": "f", "jackeline": "f", "talita": "f", "thalita": "f", "samara": "f",
        "samanta": "f", "samantha": "f", "raquel": "f", "flavia": "f", "paloma": "f", "pamela": "f",
        "mary": "f", "linda": "f", "barbara": "f", "elizabeth": "f", "jennifer": "f", "susan": "f",
        "margaret": "f", "dorothy": "f", "lisa": "f", "nancy": "f", "karen": "f", "betty": "f", "helen": "f",
        "donna": "f", "carol": "f", "ruth": "f", "sharon": "f", "sarah": "f",
        "kimberly": "f", "shirley": "f", "angela": "f",
        "brenda": "f", "amy": "f", "anna": "f", "rebecca": "f", "virginia": "f", "kathleen": "f",
        "martha": "f", "debra": "f", "stephanie": "f", "carolyn": "f", "christine": "f",
        "marie": "f", "janet": "f", "catherine": "f", "frances": "f", "ann": "f", "joyce": "f", "diane": "f",
        "julie": "f", "heather": "f", "teresa": "f", "doris": "f", "gloria": "f", "evelyn": "f",
        "jean": "f", "cheryl": "f", "mildred": "f", "katherine": "f", "joan": "f", "ashley": "f", "judith": "f",
        "janice": "f", "nicole": "f", "judy": "f", "christina": "f", "kathy": "f",
        "theresa": "f", "beverly": "f", "tammy": "f", "irene": "f", "jane": "f", "lori": "f",
        "marilyn": "f", "kathryn": "f", "louise": "f", "sara": "f", "anne": "f",
        "jacqueline": "f", "wanda": "f", "bonnie": "f", "ruby": "f", "lois": "f", "tina": "f",
        "phyllis": "f", "norma": "f", "diana": "f", "annie": "f", "lillian": "f", "emily": "f",
        "robin": "f",

        // Exceptions and Uniques
        "luca": "m", "gian": "m",
        "ariel": "u", "sasha": "u", "jordan": "u", "casey": "u", "taylor": "u", "dominique": "u"
    };

    /**
     * LiaGender Class
     */
    class LiaGender {
        constructor() {
            this.db = GENDER_DB;
        }

        /**
         * Predicts gender from a full name or first name.
         * @param {string} name - The name to analyze.
         * @returns {'male' | 'female' | null} - The predicted gender.
         */
        predict(name) {
            if (!name) return null;

            // 1. Clean and extraction
            const cleanName = name.trim().toLowerCase()
                .replace(/[0-9]/g, '')
                .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''); // Remove emojis

            // Get first token (first name)
            const parts = cleanName.split(/[\s-]+/);
            let firstName = parts[0];

            // Filter titles if present (Mr, Mrs, Dr, Dra)
            const titles = ['mr', 'mr.', 'dr', 'dr.', 'eng'];
            const fTitles = ['mrs', 'mrs.', 'ms', 'ms.', 'dra', 'dra.', 'sra', 'sra.'];

            if (titles.includes(firstName) && parts.length > 1) firstName = parts[1];
            if (fTitles.includes(firstName)) return 'female';
            if (firstName === 'sr' || firstName === 'sr.') return 'male';

            // Remove special chars for lookup
            const lookupName = firstName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // 2. Direct Dictionary Lookup
            if (this.db[lookupName]) {
                const g = this.db[lookupName];
                if (g === 'm') return 'male';
                if (g === 'f') return 'female';
                return null; // u or unknown
            }

            // 3. Heuristics (Portuguese/Latin/Romance focus)

            // Starts with exceptions
            // (Handled by dictionary mainly)

            // Ends with 'o' (often Male)
            // Exceptions: Socorro, Consuelo (rare)
            if (firstName.endsWith('o') || firstName.endsWith('os')) return 'male';

            // Ends with 'a' (often Female)
            // Exceptions: Luca, Gianluca (handled by dictionary or logic below if generic)
            if (firstName.endsWith('a') || firstName.endsWith('as')) {
                // Check common male endings in 'a':
                // Not exhaustive but helps
                return 'female';
            }

            // Ends with 'son' (Male: jackson, robson)
            if (firstName.endsWith('son')) return 'male';

            // Ends with 'el' (often Male: daniel, gabriel, miguel, rafael)
            // Exceptions: isabel, raquel (dictionary handles)
            // if (firstName.endsWith('el')) return 'male'; // Risky without dict support (mabel, isabel)

            // Ends with 'ette' or 'elle' (Female: michelle, janette)
            if (firstName.endsWith('ette') || firstName.endsWith('elle') || firstName.endsWith('elly')) return 'female';

            // Fallback
            return null;
        }
    }

    // Expose globally
    window.LiaGender = new LiaGender();
    console.log('[Lia 360] Gender Module Ready');

})();
