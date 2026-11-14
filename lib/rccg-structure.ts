/**
 * RCCG Rivers Province 10: every zone, area and parish, taken from the province's official zone report (19 zones, 59 areas, 193 parishes).
 * Loaded into the database once, automatically, so the zone / area / parish drop-downs are ready everywhere. Edit the live list at /admin/organizations.
 * `active: false` marks a parish the report lists as not active: it is kept on record but hidden from the drop-downs.
 */
export type SeedParish = { name: string; code: string; phone: string; address: string; active: boolean };
export type SeedArea = { name: string; code: string; parishes: SeedParish[] };
export type SeedZone = { name: string; code: string; areas: SeedArea[] };

export const RIVERS10_STRUCTURE: SeedZone[] = [
  { name: "All Sufficient God", code: "ZN0000006338", areas: [
    { name: "All Sufficient God", code: "AR0000006338", parishes: [
      { name: "All Sufficient God", code: "993121", phone: "08036669909", address: "2, CHINW0 STR. OFF J.D. OKENE STR", active: true },
      { name: "Royal Assembly", code: "570959", phone: "08060411878", address: "OPP. ST PHILIP ANG. CHURCH, RUMUNDURU", active: true },
      { name: "Trinity", code: "958083", phone: "08068275568", address: "PETER OKENE CLOSE, BY OGUNKA STR, RUMUEWHARA", active: true },
    ] },
    { name: "Excellent Glory Assembly", code: "AR0000007049", parishes: [
      { name: "Excellent Glory Assembly", code: "761386", phone: "08035076158", address: "3 ELEWA AVE. OFF EAST-WEST RD,RUMUODARA", active: true },
      { name: "God's Throne", code: "856746", phone: "08036696561", address: "27, COMRADE BROWN ONUKEM RUMUDARA", active: false },
      { name: "RCCG Excellent God", code: "939851", phone: "08037571432", address: "1, JAMAICA BUS STOP, EAST WEST ROAD RUMUDARA , PORTHARCOURT", active: true },
    ] },
    { name: "His Love", code: "AR0000007046", parishes: [
      { name: "Everlasting God", code: "947276", phone: "08038924136", address: "No.6 Manuyewhor Close, opposite Eaulo, Bus Stop Rumuiwara", active: true },
      { name: "His Glorious Presence", code: "842670", phone: "07034578686", address: "QUEENS PARK ESTATES ENEKA ROAD", active: true },
      { name: "His Love", code: "818811", phone: "08033676957", address: "NO 83 ENEKA RD. RUMUDURU, PHC", active: true },
      { name: "His Praise", code: "542208", phone: "08037784505", address: "REDEEMER AVENUE RUMUOGUNUMA ENEKA", active: true },
    ] },
  ] },
  { name: "Breakthrough", code: "ZN0000006342", areas: [
    { name: "Breakthrough", code: "AR0000006342", parishes: [
      { name: "Arise and Shine", code: "962014", phone: "07062136348", address: "AFTER M.K SQUARE, DEGEMA", active: true },
      { name: "Breakthrough", code: "828194", phone: "07038734992", address: "BESIDE GOVERNOR'S LODGE,CONSULATE, DEGEMA.", active: true },
      { name: "Ressurection", code: "740767", phone: "08065034178", address: "AGRIC WATER SIDE JUNCTION, DEGEMA.", active: true },
      { name: "Rock of Ages", code: "821845", phone: "08029253529", address: "DEGEMA", active: true },
    ] },
    { name: "Royal Priesthood", code: "AR0000008556", parishes: [
      { name: "Messiah Sanctuary", code: "707064", phone: "08027703374", address: "ORUOTUBO POLO, OGURU AMAOLD BAKANA", active: true },
      { name: "RCCG Open Heaven", code: "689491", phone: "08063594806", address: "FOUCHE COMMUNITY, NEW BAKANA", active: true },
      { name: "Royal Priesthood", code: "556168", phone: "08027703374", address: "SUKUPOLO, OGURAMA OLD BAKANA", active: true },
      { name: "Tree of Life", code: "872070", phone: "08037571726", address: "AKILO WATERSIDE, NEW BAKANA", active: true },
    ] },
    { name: "Tabernacle of Grace", code: "AR0000008255", parishes: [
      { name: "Tabernacle of Grace", code: "556971", phone: "08081250984", address: "125 OPU ANGULA COMPOUND ADJACENT AIRTEL MAST.", active: true },
      { name: "Tabernacle of Triumph", code: "983453", phone: "08029281640", address: "OPU IMO COMMUNITY SQUARE, BILE KINGDOM DEGEMA RIVERS STATE.", active: true },
    ] },
  ] },
  { name: "City of Joy Mega Prov. H/Qs", code: "ZN0000002646", areas: [
    { name: "City of Joy Mega Prov. H/Qs", code: "AR0000002646", parishes: [
      { name: "City of Joy Mega Prov. H/Qs", code: "539401", phone: "08033091847", address: "5, HOLINESS STREET, OFF RUMUAGHOLU ROAD, RUMUOKORO, PORT-HARCOURT, RIVERS STATE", active: true },
    ] },
    { name: "City on the Hill", code: "AR0000007788", parishes: [
      { name: "RCCG Potter's House Parish", code: "378186", phone: "2348035085480", address: "ROAD 35, CHINYERE MATERNITY ROAD, RUMUCHIORLU ENEKA, OBIO-AKPOR LGA, PORT HARCOURT, RIVERS STATE.", active: true },
    ] },
    { name: "Jesus Pavillion", code: "AR0000011453", parishes: [
      { name: "Mount Zion Parish", code: "455872", phone: "2342348058254660", address: "OMOWUSI FARM ROAD BY GOOD NEIGBOUR ESTATE", active: true },
    ] },
  ] },
  { name: "City of Praise", code: "ZN0000007040", areas: [
    { name: "City of Praise", code: "AR0000007040", parishes: [
      { name: "City of Praise", code: "898982", phone: "08099217148", address: "OKEMINI ROAD RUMUOGHOLU", active: true },
      { name: "Emmanuel", code: "893693", phone: "08064698861", address: "OMO'ODO ROAD PIPELINE RUMUAGHOLU PHC.", active: true },
      { name: "Love Assembly", code: "614894", phone: "08034835543", address: "FREEDOM ROAD OFF ANYA WATERSIDE", active: true },
    ] },
    { name: "Praise Assembly", code: "AR0000012236", parishes: [
      { name: "Gift of Life", code: "793462", phone: "08038864692", address: "FARM RD, RUMUODORLU", active: true },
      { name: "Grace and Glory", code: "591289", phone: "08037984527", address: "OPPOSITE RESURRECTION CATHOLIC CHURCH SARS ROAD, RUPOKWU", active: true },
      { name: "House of Wonders", code: "907155", phone: "08037088229", address: "NO 5 WORLU STREET, RUMUAGHOLU", active: true },
      { name: "Praise Assembly", code: "849537", phone: "08037457945", address: "CHIEF JAMES JEPHTHAH GARDEN ESTATE (OFF SARS ROAD) RUMUAGHAOLU NEW LAYOUT", active: true },
    ] },
    { name: "Royal Palace", code: "AR0000011360", parishes: [
      { name: "Fountain of Peace", code: "811224", phone: "08033909874", address: "OFF FIVE FINGER BUS STOP ALONG RUMUAGHOLU ROAD RUMUAGHOLU PORT HARCOURT RIVERS STATE.", active: true },
      { name: "Royal Palace", code: "842768", phone: "08033104775", address: "CHIEF J.K OGBONDA WELL STREET, RUMUAGHOLU PH", active: true },
    ] },
  ] },
  { name: "Fountain of Life", code: "ZN0000006337", areas: [
    { name: "Bread of Heaven", code: "AR0000006782", parishes: [
      { name: "Bread of Heaven", code: "781218", phone: "08035512475", address: "OFF NO. 5, RUMUAGHOLU RD, RUMUAGHOLU,PH", active: true },
      { name: "City of David", code: "900720", phone: "234", address: "RD 20, RUMUAGHOLU ROAD", active: true },
      { name: "Root of David", code: "587473", phone: "08034758300", address: "9, KAMALU STR. NKPOLU,", active: true },
    ] },
    { name: "City of Favour", code: "AR0000007041", parishes: [
      { name: "Bright and Morning Star", code: "752629", phone: "08023103571", address: "ALONG JERRY JUSTICE STREET, FAVOR ESTATE OPP. JEPHTATH COLLEGE, EAST-WEST ROAD.", active: true },
      { name: "City of Favour", code: "961151", phone: "08035701984", address: "KM 3, BEHIND SPRINKLER BAR EASTWEST RDUNIPORT NKPOLU-RUMUIGBO", active: true },
    ] },
    { name: "Fountain of Life", code: "AR0000006337", parishes: [
      { name: "Fountain of Life", code: "538293", phone: "08033094439", address: "NO 7 WOKO AVENUE OFF NKPOLU PLAYGROUND NKPOLU RUMUIGBO", active: true },
      { name: "Jesus the Burden Bearer", code: "997483", phone: "09036342707", address: "BORROW PIT RAGHOLU PHC", active: true },
    ] },
    { name: "Garment of Salvation", code: "AR0000006065", parishes: [
      { name: "Champions Assembly", code: "876427", phone: "08037062731", address: "AGBARA ROAD, RUMUAGHOLU", active: true },
      { name: "Garment of Salvation", code: "727502", phone: "08037315745", address: "OPPOSITE 5 FINGER BUS STOP, RUMUAGHOLU PIPELINE ROAD, RUMUAGHOLU TOWN, PH.", active: true },
      { name: "House of Miracle", code: "901374", phone: "08033381888", address: "CHRIST THE LAMB CLOSE OFF FARM ROAD RUMUAGHOLU PORT HARCOURT", active: true },
    ] },
    { name: "Power of Resurrection", code: "AR0000007039", parishes: [
      { name: "Glory of God", code: "990600", phone: "07063212227", address: "AFTER PIPELINE RUMUOGHOLU", active: true },
      { name: "Power of Resurrection", code: "843887", phone: "08033420933", address: "ANYA WATER SIDE, RUMUAGHOLU, PH", active: true },
    ] },
  ] },
  { name: "Fountain of Life 1", code: "ZN0000007114", areas: [
    { name: "City of Light", code: "AR0000006785", parishes: [
      { name: "Chapel of Victory", code: "557914", phone: "08033098676", address: "PIPELINE ROAD, RUMUAGHOLU, PH", active: true },
      { name: "City of Light", code: "698173", phone: "08037183297", address: "AGBARA ROAD, RUMUAGHOLU", active: true },
      { name: "Wonders of Light", code: "941368", phone: "08038710532", address: "PIPELINE RUMUAGHOLU PORT HARCOURT", active: true },
    ] },
    { name: "Fountain of Life 1", code: "AR0000007114", parishes: [
      { name: "Fountain of Life 1", code: "582732", phone: "08072556592", address: "OKOCHA NEW LAYOUT, RUKPAKWULUSI PHC", active: true },
      { name: "Ressurection Power", code: "932869", phone: "08062813191", address: "RUKPAKULUSHI NEW LAYOUT", active: true },
    ] },
    { name: "Gods City", code: "AR0000011366", parishes: [
      { name: "Chapel of Testimony", code: "860051", phone: "08064206755", address: "30 EZE SN WALI STREET OFF OTUNDA STREET, OFF RUMUAGHOLUROAD, NKPOLU-RUMUIGBO PORTHARCOURT.", active: true },
      { name: "City of Winners", code: "885311", phone: "08035469602", address: "ROAD 5, PIPELINE, RUMUAGHOLU", active: true },
      { name: "Gods City", code: "571197", phone: "08132717998", address: "OHIARUMUOKE CLOSE NKPOLU", active: true },
    ] },
    { name: "Holyghost Arena", code: "AR0000012052", parishes: [
      { name: "Goshen Assembly", code: "909008", phone: "08038179761", address: "SARS ROAD RUMUAGHOLU", active: true },
      { name: "Holyghost Arena", code: "989074", phone: "07038789988", address: "320 RUMUAGHOLU PIPELINE ROAD AFTER LAST BUS-STOP", active: true },
      { name: "RCCG Perfect Gift Parish", code: "794928", phone: "07032473375", address: "13 LEMON DRIVE, CEDARWOOD ESTATE , OFF SARS ROAD OFF CELESTINE OMEHIA ROAD, PORT HARCOURT RIVERS STATE.", active: true },
      { name: "Solomon Porch", code: "833535", phone: "08035491011", address: "OPPOSITE ROAD 20, RUMUOGHOLU.", active: true },
    ] },
  ] },
  { name: "Fountain of Love", code: "ZN0000006946", areas: [
    { name: "Fountain of Love", code: "AR0000006946", parishes: [
      { name: "Fountain of Love", code: "931984", phone: "08034696387", address: "BEHIND MODEL PRIMARY SCH. OFF RUKPOKWU - ENEKA ROAD,RUKPOKWU, PORT HARCOURT", active: true },
      { name: "Fountain of Miracle", code: "715391", phone: "08063817331", address: "ALUU JUNCTION POLICE CHECK POINT", active: true },
      { name: "Living Way", code: "607248", phone: "08068834191", address: "OFF 114 ENEKA ROAD, RUKPOKWU, PORT HARCOURT", active: true },
      { name: "The Zionites Chapel", code: "779683", phone: "08055906250", address: "FARM RD, RUMUAKPU VILLAGE, OFF ENEKA RD AP SOLOMON IMHANLUHE", active: true },
    ] },
    { name: "Jesus Pavillion", code: "AR0000011453", parishes: [
      { name: "Jesus Pavillion", code: "780030", phone: "08033208523", address: "WORLU WOGU STREET, BESIDE HAPPY STREET TOTAL BUS STOP RUKPOKWU", active: true },
      { name: "The Citizen", code: "937790", phone: "07030506392", address: "ALU ROAD RUKPOKWU", active: true },
      { name: "Wonderful", code: "662218", phone: "08037449416", address: "UMUOLUTA NDDC FARM ROAD IGRWURUTALI IKWERRE LGA", active: true },
    ] },
    { name: "The Kings Place", code: "AR0000006058", parishes: [
      { name: "Halleluyah House", code: "826639", phone: "08130318877", address: "OFF ELIKPOKWUODU ROAD BY UNITY GAS RUKPOKWU PORTHARCOURT.", active: true },
      { name: "Jesus Heritage", code: "857232", phone: "07032722483", address: "CHIEF AMADI CLOSE, ELIKPOKWODU", active: true },
      { name: "Kings Dominion", code: "708858", phone: "08065856444", address: "LAST BUS STOP, OFF ELIKPOKWUODU, ALUU ROAD, RUKPOKWU, PORT HARCOURT, RIVERS STATE", active: true },
      { name: "The Kings Peace", code: "819036", phone: "08037453728", address: "OPURUM STREET, OFF ELIKPOKWUODU ROAD, RUKPOKWU, PORT HARCOURT, RIVERS STATE.", active: true },
      { name: "The Kings Place", code: "958216", phone: "08060999518", address: "BESIDE CHERUKEI GUEST HOUSE, OFF ELIKPOKWUODU ROAD, RUKPOKWU, PORT HARCOURT, RIVERS STATE", active: true },
    ] },
  ] },
  { name: "Good Shepherd", code: "ZN0000006340", areas: [
    { name: "El-Shaddai", code: "AR0000007113", parishes: [
      { name: "El-Shaddai", code: "584858", phone: "08029213449", address: "EL-SHADDAI STR, OFF FARM RD. ELIOZU", active: true },
      { name: "Everlasting Joy", code: "539325", phone: "08034009164", address: "NO. 11B AMAEWHULE STREET ELIOZU-OROIGWE OFF G.U. AKE ROAD, PORT HARCOURT", active: true },
      { name: "His Light", code: "845804", phone: "08037581173", address: "HIS LIGHT CLOSE, OFF FARM RD. ELIOZU", active: true },
    ] },
    { name: "Good Shepherd", code: "AR0000006340", parishes: [
      { name: "Exalted Place", code: "867563", phone: "08061139955", address: "OHIA IGBA ESTATE RUMUNDURU PHC.", active: true },
      { name: "Good Shepherd", code: "761953", phone: "07039369772", address: "G. U. AKE ROAD, ELIOZU,PORT HARCOURT", active: true },
      { name: "Green Pasture", code: "669760", phone: "08036769432", address: "G.U AKE ROAD", active: true },
    ] },
    { name: "Rehoboth", code: "AR0000007115", parishes: [
      { name: "Grace Sanctuary", code: "585092", phone: "08038853849", address: "14 OMACHI STREET, ELIOWHANI PORT HARCOURT", active: true },
      { name: "Great Shepherd", code: "900560", phone: "08032614819", address: "138, ORIGWE ROAD RUMUEWHARA, PHC", active: true },
      { name: "Peculiar People", code: "716477", phone: "08036681021", address: "1, CIRCULAR ROAD GODS OWN ESTATE BY NEW ROAD OPPOSITE ADAMAC OFF EAST WEST ROAD, PORT HARCOURT, RIVERS STATE", active: true },
      { name: "Rehoboth", code: "818088", phone: "08033387040", address: "RUMUODARA, PH", active: true },
    ] },
  ] },
  { name: "Habitation", code: "ZN0000006948", areas: [
    { name: "City on the Hill", code: "AR0000007788", parishes: [
      { name: "City on the Hill", code: "866165", phone: "08036908557", address: "BEHIND PRIS HOTEL, RUMUOJI, ENEKA", active: true },
      { name: "Glorious Bethel", code: "735409", phone: "08036202645", address: "ENEKA", active: true },
      { name: "Great Things", code: "607773", phone: "08063421402", address: "RUMUOJI PIPELINE, ENEKA", active: true },
      { name: "House of Miracle", code: "713139", phone: "08039235400", address: "OKARA FARMLAND RUMUCHIOLU VILLAGE, ENEKA", active: true },
      { name: "Tabernacle of David", code: "746385", phone: "08032850800", address: "ENEKA PHC", active: true },
    ] },
    { name: "Friends of Jesus", code: "AR0000007825", parishes: [
      { name: "Bethel", code: "870432", phone: "08033094327", address: "ALONG BETHEL ROAD, OFF PIPELINE OFF RUKPOKWU- ENEKA ROAD BEFORE MORIEN INTERNATIONAL SCH. PHC", active: true },
      { name: "Friends of Jesus", code: "838629", phone: "08063944180", address: "OFF ENEKA-ATALI ROAD OPPOSITE ROSCO FILLING STATION, RUMUEWADARA ATALI", active: true },
      { name: "King of Saints", code: "892770", phone: "08032753225", address: "5 ATALI RD DAWSON HOTEL ATALI", active: true },
      { name: "The Overflow", code: "998040", phone: "07050993579", address: "207 ENEKA RD.", active: true },
    ] },
    { name: "Habitation", code: "AR0000006948", parishes: [
      { name: "City of God", code: "588226", phone: "08065524267", address: "POULTRY ROAD BY ENEKARUKPOKWU RD ENEKA, PH", active: true },
      { name: "Habitation", code: "567808", phone: "08033166764", address: "NO 6B, NAPOLEON DEDE CLOSE, OFF NDDC ROAD, OFF IGBO ETCHE ROAD, OLUKWU LAYOUT ENEKA, PORT HARCOURT", active: true },
      { name: "King of Glory Parish", code: "298523", phone: "2348060808483", address: "OFF FELIX ASEMOTA STREET, IGBOETCHE, ELEME, RIVERS STATE", active: true },
      { name: "Living Grace", code: "799424", phone: "08064886920", address: "ONUMA ROAD. ENEKA", active: true },
    ] },
  ] },
  { name: "House of Grace", code: "ZN0000006335", areas: [
    { name: "House of Grace", code: "AR0000006335", parishes: [
      { name: "Chapel of Miracle", code: "803193", phone: "08033590840", address: "RUKPOKWU PORTHARCOURT", active: true },
      { name: "City of Signs & Wonders", code: "721555", phone: "08034541372", address: "OHIA AGBADA OFF OGBOD ROAD OFF ENEKA ROAD", active: true },
      { name: "House of Grace", code: "766886", phone: "08078050252", address: "OGBODO STREET APU ROAD", active: true },
      { name: "Praise Palace", code: "615814", phone: "08037722042", address: "OHIAMINI-APU, RUMUAPU, OFF ENEKA ROAD, RUKPOKWU, PORT HARCOURT, RIVERS STATE", active: true },
      { name: "RCCG House of Joy Parish", code: "375899", phone: "2349057920322", address: "2ND AVENUE, APU OGBODO ROAD, RUMUAPU-RUKPOKWU, OBIO/AKPOR LGA, PORT HARCOURT", active: true },
    ] },
    { name: "Living Waters", code: "AR0000011454", parishes: [
      { name: "Chapel of Revival", code: "860190", phone: "08036699379", address: "PIPELINE, RUMUOWA ENEKA PORT HARCOURT", active: true },
      { name: "Living Waters", code: "924297", phone: "08035079295", address: "39 AIRPORT RD, RUMUJIME, RUKPOKWU", active: true },
      { name: "Our Lord Reigns", code: "703960", phone: "08080588636", address: "BEHIND SHELL MANIFOLD OFF PIPELINE", active: true },
    ] },
    { name: "Spring of Praise", code: "AR0000007038", parishes: [
      { name: "Garden of Peace", code: "825927", phone: "08175154552", address: "PRINCR OBI DRIVE, RUMUONWU, ENEKA", active: true },
      { name: "Power Assembly", code: "735768", phone: "08036378678", address: "NKPOLU FARM ROAD, ENEKA", active: true },
      { name: "Solution Sactuary", code: "563596", phone: "08036692838", address: "BEHIND BORO PIT, ENEKA RUPOKWU ROAD ENEKA PHCENEKA", active: true },
      { name: "Spring of Praise", code: "909091", phone: "08064198826", address: "BRIDGE HOTEL JUNCTION ROAD ENEKA PHC", active: true },
    ] },
  ] },
  { name: "House of Power", code: "ZN0000006064", areas: [
    { name: "House of Power", code: "AR0000006064", parishes: [
      { name: "House of Power", code: "567483", phone: "08037903883", address: "33, OMODORBRO RD, RUMUAGHOLU", active: true },
    ] },
  ] },
  { name: "Jehovah Shammah", code: "ZN0000006339", areas: [
    { name: "Dominion Arena", code: "AR0000007956", parishes: [
      { name: "Dominion Arena", code: "727388", phone: "08032608332", address: "BY COMMAND ESTATE OFF RD ROAD OFF OKPORO ROAD, RUMUODARA PH", active: true },
      { name: "The Lord's Ark", code: "885125", phone: "08033093767", address: "24 ONUKEM AVENUE RUMUODARA RD, BESIDE SHANDEES EATRY", active: true },
    ] },
    { name: "Dominion Sanctuary", code: "AR0000006956", parishes: [
      { name: "Covenant Place", code: "575415", phone: "08028039375", address: "42, OKPORO ROAD PHC", active: true },
      { name: "Dominion Sanctuary", code: "542142", phone: "08071418314", address: "125B OKPORO RD PH", active: true },
      { name: "Greater Joy", code: "920619", phone: "08120840311", address: "10, OMUBO CLOSE RUMUDARA PH", active: true },
    ] },
    { name: "Glorious Assembly", code: "AR0000011412", parishes: [
      { name: "Glorious Assembly", code: "734275", phone: "08039402512", address: "NO.7 MINI AZA CRESENT ELLIOGBOLO", active: true },
      { name: "Love Assembly", code: "770986", phone: "08038021828", address: "22, OHIA RUMUOKE STREET NKPOLU", active: true },
      { name: "The Shepherd House", code: "652658", phone: "08035513181", address: "18 ONUMINI STREET, ELIGBOLO", active: true },
    ] },
    { name: "Jehovah Shammah", code: "AR0000006339", parishes: [
      { name: "Dominion City", code: "695509", phone: "08058395684", address: "OPP. TESSY SCH. RUMUAGHOLU", active: true },
      { name: "Jehovah Shammah", code: "717027", phone: "08036335856", address: "5 ECHE OBUE CLOSE OFF ELLIOGBOLO RD RUMUODAMAYA", active: true },
      { name: "RCCG House of Praise", code: "538165", phone: "08030612439", address: "BACK OF STATION OMAGWA TOWN, PORTHARCOURT", active: true },
      { name: "The Shepherds Place", code: "716302", phone: "08065636302", address: "2, CHUKWU CLOSE OFF ELIGBOLO RD RUMUODOMAYA", active: true },
    ] },
  ] },
  { name: "New Breed", code: "ZN0000006343", areas: [
    { name: "New Breed", code: "AR0000006343", parishes: [
      { name: "New Breed", code: "773104", phone: "08033106832", address: "3, WENADA STR, BY POWER ENCOUNTER RD, OFF EAST WEST ROAD, RUMUODARA", active: true },
    ] },
  ] },
  { name: "New Dawn", code: "ZN0000006784", areas: [
    { name: "Grace and Favour", code: "AR0000011362", parishes: [
      { name: "Dew of Harmon", code: "550245", phone: "08039658421", address: "ALONG OBIRIKWERE EXPRESS RUMUAGHOLU PORTHARCOURT, RIVERS 10", active: true },
      { name: "Grace and Favour", code: "553890", phone: "08135805100", address: "105 RUMUAGHOLU ROAD RUMUOGHOLU JUNCTION", active: true },
      { name: "House of Favour", code: "818099", phone: "08037374378", address: "AZU-MINI SOUNDS FARMLAND, ROAD 1,PIPELINE, RAGHOLU, PHC", active: true },
    ] },
    { name: "Key of David", code: "AR0000007042", parishes: [
      { name: "Excellent People", code: "839731", phone: "08038448923", address: "KM 2, EAST-WEST OPPOSITE CITIZEN FILLING STATION", active: true },
      { name: "Glorious King", code: "976331", phone: "08091040015", address: "OVUNWO STR, OFF RUMUAGHOLU ROAD, BY APC BUS STOP. RUMUAGHOLU", active: true },
      { name: "Key of David", code: "702329", phone: "08033132618", address: "RUMUGHOLU NKPOLU, RUMUIGBO, PH", active: true },
    ] },
    { name: "New Dawn", code: "AR0000006784", parishes: [
      { name: "New Dawn", code: "928187", phone: "08096486667", address: "75 NKPOLU -RUMUIGBO ROAD NKPOLU PORT HARCOURT.", active: true },
      { name: "Solid Rock", code: "669307", phone: "08038882993", address: "END OF ORO-AKA STREET RUMUAGHOLU", active: true },
      { name: "The Great Provider", code: "590425", phone: "08134931056", address: "ROAD 11, RUMUAGHOLU, RIVERS STATE.", active: true },
    ] },
  ] },
  { name: "New Fountain of Life", code: "ZN0000006780", areas: [
    { name: "Abrahams Seed", code: "AR0000006778", parishes: [
      { name: "Abrahams Seed", code: "616645", phone: "08163492562", address: "OBUAMA, HARRY'S TOWN, DEGEMA LGA", active: true },
      { name: "King's Court Parish", code: "832590", phone: "08034065298", address: "IWO POLO AFTER OBUAMA COMMUNITY TOWN SQUARE, DEGEMA LGA RIVERS STATE", active: true },
      { name: "Tabernacle of His Glory", code: "735541", phone: "08143835858", address: "USOKUN, DEGEM,A LGA", active: true },
    ] },
    { name: "Halleluyah", code: "AR0000008263", parishes: [
      { name: "City of Blessing", code: "793670", phone: "07010290575", address: "TOMBIA DEGEMA, RIVERS STATE.", active: true },
      { name: "City of Favour", code: "985652", phone: "09020196627", address: "ALAKA EXPRESS ROAD, BUKUMA RIVERS STATE.", active: true },
      { name: "City of Praise", code: "923866", phone: "08097349313", address: "NEW SITE BY OBOKO POLO, TOMBIA-KINGDOM", active: true },
      { name: "Halleluyah", code: "955096", phone: "08163492562", address: "KING OMUSOYE ABBEY POLO, TOMBIA, DEGEMA LGA", active: true },
    ] },
    { name: "New Fountain of Life", code: "AR0000006780", parishes: [
      { name: "Gods Kingdom Assembly", code: "584845", phone: "09070812985", address: "CHIEF JIM WILLIAMS HOUSE USOKUN- DEGEMA", active: true },
      { name: "Jesus the Living Hope", code: "606104", phone: "08068767567", address: "USOKUN, DEGEM,A LGA", active: true },
      { name: "Livingstone", code: "985061", phone: "08032734771", address: "DEGEMA", active: true },
      { name: "New Fountain of Life", code: "811278", phone: "07061517060", address: "UPULO IMIVITAM AREA OFF MONIMA LAWSON CLOSE USOKUN-DEGEMA", active: true },
    ] },
  ] },
  { name: "Praise Chapel", code: "ZN0000006786", areas: [
    { name: "Jesus Rock", code: "AR0000007828", parishes: [
      { name: "Jesus Rock", code: "745882", phone: "08033417593", address: "#24 ORO-ETCHE ENEKA OPPOSITE SARIMIMA PLAZA OFF ENEKA—IGWURITA ROAD", active: true },
      { name: "Kings Praise", code: "897699", phone: "08134878458", address: "HOMELIGHT GARDENS ESTATE ENEKA BY LGBO ETCHE, OFF ARMY RANGE", active: true },
      { name: "Light of Life", code: "583704", phone: "07034444183", address: "RUMUOGWUNUMA FARM ROAD ENEKA (WOSU CLOSE)", active: true },
      { name: "Promise Land", code: "666758", phone: "07035451149", address: "RUMUESARA NEW LAYOUT BY THE FIELD RUMUESARA, ENEKA", active: true },
      { name: "Word of Life", code: "759925", phone: "08033777671", address: "NDDC ROAD ALONG RUMUOLUKU NEW LAYOUT ENEKA,PORTHARCOURT.", active: true },
    ] },
    { name: "Living Bread", code: "AR0000007824", parishes: [
      { name: "Balm of Gilead", code: "645755", phone: "08038747777", address: "ENEKA IGWURUTA ROAD BY CHINYERE MATERNITY BEHIND NEW RUMUORCHOLU MARKET, ENEKA.", active: true },
      { name: "Crown of Glory", code: "606368", phone: "08068267496", address: "OFF NDDC ROAD,SHELL PIPELINE RUMUOLUKWU NEW LAYOUT, ENEKA, PORTHARCOURT.", active: true },
      { name: "Kings City", code: "779322", phone: "08064043328", address: "RUMUOLUKWO ENEKA", active: true },
      { name: "Living Bread", code: "573443", phone: "08037919522", address: "OFF NDDC ROAD OLUKWU LOUT ENEKA", active: true },
      { name: "The Abundant Grace", code: "652517", phone: "08037398305", address: "46, RUMUNDURU RD, NEAR 404 CANTEEN", active: true },
      { name: "Way Maker", code: "779775", phone: "08028256160", address: "OFF PIPELINE ENEKA PORT HARCOURT", active: true },
    ] },
    { name: "Praise Chapel", code: "AR0000006786", parishes: [
      { name: "Abundant Life", code: "957453", phone: "08061352350", address: "ELDER JOHN CHIOLOJI STREET OFF OSITA STREET RUMUOWHA OFF IGWURUTAENEKA ROAD BY HIGHER GROUND BUS STOP PHC.", active: true },
      { name: "His Divine Power", code: "566789", phone: "08056581998", address: "SMART AVENUE", active: true },
      { name: "Praise Chapel", code: "672044", phone: "08034778341", address: "RUMUDARAENEKA ROAD, RUMUNDURU. PH", active: true },
      { name: "RCCG Prince of Peace", code: "902185", phone: "08165011936", address: "PARADISE ESTATE OFF SMART AVENUE OFF RUMUDARA ENEKA ROAD PORTHARCOURT", active: true },
    ] },
  ] },
  { name: "Royal Assembly", code: "ZN0000007112", areas: [
    { name: "City of Glory", code: "AR0000047830", parishes: [
      { name: "City of Glory", code: "914808", phone: "08038992476", address: "25,ROAD 8, ELIWELIBO, RUMUAGHOLU EXTENTION, OFF SARS ROAD, OBIOAKPOR. RIVERS STATE.", active: true },
      { name: "City of Peace", code: "572844", phone: "08060191972", address: "14 PEACE AVENUE, OFF ROAD 20,RUMUAGHOLU PIPELINE, PORT HARCOURT. RIVERS STATE", active: true },
      { name: "City of Wonders", code: "841154", phone: "08063373311", address: "OMUIKE VILLAGE OFF ALUU OMAGWA ROAD OMUIKE ALUU", active: true },
      { name: "Dominion Chapel", code: "581932", phone: "08039408488", address: "MARKET ROAD, ELIPKOWUODU BY ABUOTU PLAZA", active: true },
      { name: "Living Proof", code: "939438", phone: "08037581777", address: "ELIWELIBO OPPOSITE SARS RUMUGHOLU", active: true },
      { name: "The Treasured People Parish", code: "669349", phone: "08067936888", address: "NDDC NEW ROAD OPARAGWA OMAGWA PORT HARCOURT RIVERS STATE.", active: true },
    ] },
    { name: "Glory of God", code: "AR0000007044", parishes: [
      { name: "Glory of God", code: "663339", phone: "08037459257", address: "7 AKWAKA STR, RUMUODAMAYA, PH", active: true },
      { name: "Kings Sanctuary", code: "836448", phone: "08037660617", address: "AKWAKA PORT HARCOURT.", active: true },
      { name: "Our Reigning King", code: "545036", phone: "08032386383", address: "PIPELINE RUMUAGHOLU, PORT HARCOURT", active: true },
      { name: "RCCG Holy House Parish", code: "920159", phone: "08034806727", address: "OMOUOHIAM FARM ROAD, OMAGWA. IKWERRE L.G.A", active: true },
    ] },
    { name: "Prevailers Assembly", code: "AR0000006787", parishes: [
      { name: "Great Gift", code: "753124", phone: "08034367341", address: "SARS AREA", active: true },
      { name: "Prevailers Assembly", code: "830791", phone: "08037071968", address: "17, ROYAL AVENUE, ALHAJI ESTATE, RODUMAYA", active: true },
      { name: "Tabernacle of David", code: "839260", phone: "08063552020", address: "ROAD 1 AKWAKA PHASE 1 RUMUODUMAYA", active: true },
    ] },
    { name: "Royal Assembly", code: "AR0000007112", parishes: [
      { name: "House of Abundance", code: "576965", phone: "07062857951", address: "OPP AMAZING GRACE HOSPITAL RUMUODOMAYA,77 AIRPORT ROAD.", active: true },
      { name: "Royal Assembly", code: "849848", phone: "08053391130", address: "1 CIRCULAR RD, OPP. OBIOAKPOR SECRETARIAT, ALHAJI ESTATE, RUMUODOMAYA", active: true },
      { name: "Watchman", code: "768532", phone: "08037095058", address: "AKWAKA", active: true },
    ] },
  ] },
  { name: "Salt and Light", code: "ZN0000006341", areas: [
    { name: "Jesus the Answer", code: "AR0000007786", parishes: [
      { name: "City of Glory", code: "877088", phone: "08055403882", address: "25,IGBO-ETCHE ROAD.", active: true },
      { name: "Double Portion", code: "613127", phone: "08182676458", address: "BY SOBAZE FILLING STATION THROUGH LION STREETOF WOKONTA AGBOKA FARM ROAD, IGRUWUTA PORTHARCOURT", active: true },
      { name: "Jesus the Answer", code: "566339", phone: "08037276106", address: "OFF FARM ROAD AFTER ENEKA FIELD RUMUESERA ENEKA", active: true },
      { name: "New Beginning", code: "658418", phone: "08034083891", address: "Upper Igwe Extension Road, Rumuowah, Off Queen Esther Junction, Eneka", active: true },
      { name: "RCCG New Life Parish", code: "706624", phone: "08035109389", address: "OKWUOGBONGWO FARMLAND NEW HEAVEN CHOKOCHO ETCHE LGA, PORTHARCOURT RIVERS STATE.", active: true },
      { name: "Resurrection Power", code: "921903", phone: "08063345683", address: "OPPOSITE LIFE BUILDER ACADEMY RUMUOJI FARM ROAD ENEKA PHC", active: true },
    ] },
    { name: "Salt and Light", code: "AR0000006341", parishes: [
      { name: "Gracious God", code: "601889", phone: "08039373497", address: "RUMUOWUTA, RUMUOWHA ENEKA.", active: true },
      { name: "Highly Favoured", code: "955872", phone: "08131922828", address: "HOSPITAL ROAD, ARMY RANGE, IGWURUTA", active: true },
      { name: "Lamb of God", code: "740650", phone: "07025394908", address: "IGWE STREET, ENEKA", active: true },
      { name: "Salt and Light", code: "824604", phone: "08033093979", address: "RUMUESARA, BEHIND SARIMA PLAZA, ENEKA PH", active: true },
    ] },
    { name: "Solution Centre (Shalom)", code: "AR0000006952", parishes: [
      { name: "God of Mercy", code: "915662", phone: "08161207459", address: "RUMUOGUNOMA, COMMUNITY BY SALAVATION MINISTRY OFF LIQUID BULK FILLING STATION ROAD", active: true },
      { name: "Good Success", code: "590467", phone: "07089447391", address: "ENEKA", active: true },
      { name: "Solution Centre (Shalom)", code: "550569", phone: "08033104869", address: "NO 1, OMUNAKWE ST., OFF RUMUEWHARA FARM RD, ATALI", active: true },
    ] },
  ] },
  { name: "Signs and Wonders", code: "ZN0000007720", areas: [
    { name: "Honoured (Throne of Grace)", code: "AR0000006954", parishes: [
      { name: "Honoured (Throne of Grace)", code: "942638", phone: "08035431011", address: "ATALI ENEKA ROAD, PH", active: true },
      { name: "Jesus Love", code: "917720", phone: "08039529277", address: "ENEKA RD ATALI, PORT HARCOURT", active: true },
      { name: "True Life", code: "633857", phone: "08038330487", address: "ATALI FARM BY ROAD SIDE", active: true },
    ] },
    { name: "Precious (Christ Church)", code: "AR0000006955", parishes: [
      { name: "Fruitful Life Sanctuary", code: "643436", phone: "08060798212", address: "RUMUKRUSHI PIPE-LINE BEFORE MTN MAST", active: true },
      { name: "Precious (Christ Church)", code: "813537", phone: "08030995684", address: "AGRIC ROAD ATALI, PH", active: true },
    ] },
    { name: "Signs and Wonders", code: "AR0000007720", parishes: [
      { name: "Beautiful City", code: "604077", phone: "09098339890", address: "HARMONY CLOSE, ENEKA", active: true },
      { name: "Good Tidings", code: "564056", phone: "08037819317", address: "FAMILY HALL, BY EKWEBELEM STREET, OFF RUMUDURU PLAY GROUND, RUMUODARA JUNCTION.", active: true },
      { name: "Lamb's Throne", code: "569402", phone: "08037049301", address: "END OF OKEY CLOSE 14 WEBILOR STR. RUMUDARA", active: true },
      { name: "Signs and Wonders", code: "593925", phone: "08066581859", address: "PLOT 13 ROAD 12B, QUEEN’S PARK ESTATE, NEAR CHIEF EZE WALE SHOPPING CENTRE ENEKA - RUMUODUMIA ROAD, PORT HARCOURT.", active: true },
    ] },
    { name: "Wonderful (House of Wonders)", code: "AR0000006950", parishes: [
      { name: "Good-News Sanctuary", code: "683460", phone: "08066974251", address: "PIPE LINE, RUMUOKRUSHI , PH", active: true },
      { name: "Oasis of Life", code: "918219", phone: "08039356225", address: "2 AMADI STR. TONY ESTATE RUMUNDURU", active: true },
      { name: "Wonderful (House of Wonders)", code: "937036", phone: "08038964357", address: "END OF MINI CHINDA ST., ELIMGBU", active: true },
    ] },
  ] },
];
