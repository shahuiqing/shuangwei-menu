import cuminLambImg from "./assets/images/cumin_lamb_bbq_1785766713790.jpg";
import garlicButterBeefImg from "./assets/images/garlic_butter_beef_1785766726305.jpg";
import lemonOrangeBeefImg from "./assets/images/lemon_orange_beef_1785766737840.jpg";
import spicySquidImg from "./assets/images/spicy_squid_bbq_1785766750067.jpg";

export const INITIAL_MENU_CATEGORIES: any[] = [
  {
    id: "all-bbq-menu-halal",
    maName: "قائمة الشواء",
    frName: "MENU BBQ",
    items: [
      {
        id: "item-cumin-lamb",
        title: "孜然羊肉",
        enTitle: "Cumin Lamb",
        frTitle: "Agneau au Cumin",
        arTitle: "لحم ضأن بالكمون",
        maTitle: "غنمي بالكامون",
        price: "MAD75",
        description:
          "精选优质嫩羊肉，搭配粒粒香浓的孜然与秘制香料，特有烤制风味，鲜嫩多汁令人回味无穷。",
        enDescription:
          "Selected tender lamb roasted with aromatic cumin seeds and secret spices, tender, juicy, and rich in barbecue flavor.",
        frDescription:
          "Tendre agneau sélectionné grillé au cumin aromatique et épices secrètes, tendre, juteux et savoureux.",
        arDescription:
          "لحم ضأن طري ممتاز مشوي مع بذور الكمون العطرية والتوابل السرية، طري ولذيذ.",
        maDescription:
          "غنمي طري مميز مشوي بالكامون والعطرية السرية، كيجي بنين وطري بزاف.",
        image: cuminLambImg,
      },
      {
        id: "item-garlic-butter-beef",
        title: "黄油蒜香牛肉",
        enTitle: "Garlic Butter Beef",
        frTitle: "Bœuf au Beurre d'Ail",
        arTitle: "لحم بقر بالثوم والزبدة",
        maTitle: "بقر بالزبذة والثومة",
        price: "MAD85",
        description:
          "严选顶级牛肉切块，浓郁黄油与金黄金蒜完美融合，上火炙烤时蒜香溢满，口感醇厚鲜嫩。",
        enDescription:
          "Premium beef cubes infused with rich garlic butter, releasing a rich fragrant aroma when grilled, tender and flavorful.",
        frDescription:
          "Dés de bœuf premium infusés au beurre d'ail riche, libérant un arôme envoûtant à la grillade.",
        arDescription:
          "مكعبات لحم بقر فاخرة متبلة بالثوم والزبدة الغنية، ذات رائحة طعام مشوية شهية.",
        maDescription:
          "طراف د اللحم البقري مرقدين ف الزبذة والثومة、 ملي كيتشواو كيعطيو ريحة لديدة بزاف.",
        image: garlicButterBeefImg,
      },
      {
        id: "item-lemon-orange-beef",
        title: "柠檬橙子拌牛肉",
        enTitle: "Lemon Orange Marinated Beef",
        frTitle: "Bœuf Mariné Citron & Orange",
        arTitle: "لحم بقر متبل بالليمون والبرتقال",
        maTitle: "بقر بالحامض والليمون",
        price: "MAD80",
        description:
          "新鲜切片牛肉加入鲜榨柠檬与甜橙果汁深层浸腌，果酸自然透肉，烤后带着淡淡柑橘清香，开胃解腻。",
        enDescription:
          "Thinly sliced beef marinated in fresh lemon and orange juices. The natural citrus acids tenderize the meat, giving it a refreshing, fragrant flavor.",
        frDescription:
          "Tranches de bœuf marinées au jus de citron et d'orange frais, apportant une touche agrume rafraîchissante et délicieuse.",
        arDescription:
          "شرائح لحم بقر متبلة بعصير الليمون والبرتقال الطازج، منعشة ولذيذة عند الشواء.",
        maDescription:
          "شرائح اللحم مرقدة ف عصير الحامض والليمون المنعش، كتجي خفيفة ولديدة.",
        image: lemonOrangeBeefImg,
      },
      {
        id: "item-spicy-squid",
        title: "香辣拌鱿鱼",
        enTitle: "Spicy Marinated Squid",
        frTitle: "Calmar Épicé Mariné",
        arTitle: "حبار متبل حار",
        maTitle: "كلمار حار",
        price: "MAD75",
        description:
          "鲜活Q弹鱿鱼特调香辣秘汁，炭火炙烤后卷曲紧实，表皮微焦，辣爽鲜美，脆弹过瘾。",
        enDescription:
          "Fresh bouncy squid marinated in a special spicy sauce. High-heat charcoal roasting makes it crispy on the outside, tender inside, and irresistibly flavorful.",
        frDescription:
          "Calmar frais mariné dans une sauce épicée spéciale, croustillant à l'extérieur et tendre à l'intérieur après grillade.",
        arDescription:
          "حبار طازج متبل بصلصة حارة ممتازة، مشوي على الفحم ومقرمش ولذيذ.",
        maDescription:
          "كلمار طري مرقد ف لاصوص الحارة، كيجي مقرمش ولذيذ ف الشواية.",
        image: spicySquidImg,
      },
      {
        arTitle: "أضلاع بقري",
        frTitle: "Travers de Bœuf",
        maDescription: "ضلوع بقري مخلطين، كيوليو فتيين وبنينين فاش كيتشواو.",
        id: "1",
        title: "牛肋条",
        enTitle: "Beef Ribs",
        frDescription:
          "Travers de bœuf sélectionnés, équilibrés, tendres et juteux, libérant un arôme alléchant après rôtissage.",
        enDescription:
          "Selected beef ribs, balanced fat and lean, tender and juicy, releasing a tempting beef fat aroma after high-temperature roasting.",
        image: "https://i.ibb.co/PsDV7NQB/228888bed624.jpg",
        arDescription:
          "أضلاع لحم بقر ممتازة، تطلق رائحة شواء فاتحة للشهية بعد التحميص عالي الحرارة.",
        description:
          "精选带肉牛肋条，肥瘦相间，肉质鲜嫩多汁，经过高温烤制后溢出诱人的牛脂香气。",
        maTitle: "ضلوع بقري",
        price: "MAD75",
      },
      {
        enDescription:
          "Premium original cut skirt steak with clear marbling. Fragrant, tender, and bouncy after roasting, offering ultimate enjoyment.",
        image: "https://i.ibb.co/2DfTVP1/c9355a32625e.jpg",
        description:
          "一头牛身上仅有的稀有部位，纤维感适中且肉汁丰富，带来极具嚼劲的极致口感。",
        arDescription: "شريحة لحم فاخرة، عطرية وطرية بعد الشواء.",
        maTitle: "لحم مميز",
        price: "MAD75",
        arTitle: "شريحة لحم مميزة",
        frTitle: "Bavette Premium",
        maDescription: "لحم فاخر، ملي كيتشوى كيولي طري ولذيذ بزاف.",
        id: "2",
        enTitle: "Skirt Steak",
        title: "横膈膜",
        frDescription:
          "Bavette premium avec de belles marbrures. Parfumée, tendre après cuisson.",
      },
      {
        enTitle: "Beef Tenderloin",
        title: "牛里脊",
        frDescription:
          "Viande maigre de très haute qualité, fond dans la bouche avec une légère cuisson.",
        arTitle: "فيليه اللحم البقري",
        frTitle: "Filet de Bœuf",
        maDescription: "لحم بقري بلا شحمة، كيذوب ف الفم ملي كتشويه شوية.",
        id: "3",
        maTitle: "فيليه د البقر",
        price: "MAD75",
        enDescription:
          "High-quality lean meat with very low fat content, extremely tender, melts in the mouth with a light roasting.",
        image: "https://i.ibb.co/WNB4Rbzg/a6ee382c56e4.jpg",
        arDescription: "لحم خالي من الدهون، طري يذوب في الفم بعد شواء خفيف.",
        description:
          "脂肪含量极低的优质瘦肉，口感极度细嫩，轻微炙烤即有化口的惊艳体验。",
      },
      {
        enDescription:
          "Evenly distributed marbling, cooks quickly over fire, rich in fat aroma, melts in the mouth.",
        image: "https://i.ibb.co/0p66DL1J/4a9d7eb0465f.jpg",
        arDescription: "توزيع دهون متساو، ينضج بسرعة ويذوب في الفم.",
        description: "油花分布均匀如同雪花，上火即熟，脂香油润，入口即化。",
        maTitle: "لحم البقر الممشق",
        price: "MAD75",
        arTitle: "لحم البقر الرخامي",
        frTitle: "Bœuf Persillé",
        maDescription: "فيه شحمة مقادة، كيطيب بالزربة وكيذوب ف الفم.",
        id: "4",
        enTitle: "Marbled Beef",
        title: "雪花肥牛",
        frDescription:
          "Marbrure bien répartie, cuit rapidement, fond dans la bouche.",
      },
      {
        arDescription:
          "طبقات واضحة من الدهون واللحم القليل الدسم، بعد الشوي يصبح لذيذاً وغير دهني.",
        description:
          "肥肉与瘦肉层次分明，经过猛火烤制后，油脂香气充分释放而且不会油腻。",
        image: "https://i.ibb.co/mrnFscBY/8fd0c91d7d08.jpg",
        enDescription:
          "Clear layers of fat and lean, releases full fat aroma after high heat roasting without being greasy.",
        price: "MAD75",
        maTitle: "صدر البقر",
        id: "5",
        maDescription:
          "لحم فيه الشحمة مقادة، ملي كيتشوى كيعطي ريحة زوينة وماكيجيش ميدم.",
        frTitle: "Poitrine de Bœuf",
        arTitle: "صدر البقر",
        frDescription:
          "Couches de gras et de maigre, libère un arôme plein sans être gras après cuisson.",
        title: "牛五花",
        enTitle: "Beef Belly",
      },
      {
        description:
          "加入新鲜水果汁腌制，天然果酸软化肉质，带来清甜的解腻口感。",
        arDescription: "متبل بعصير الفواكه الطازجة، طعم حلو ومنعش.",
        image: "https://i.ibb.co/RpG6trGH/b56b5812e80f.jpg",
        enDescription:
          "Marinated with fresh fruit juice, natural acid softens the meat, offering a sweet and refreshing taste.",
        price: "MAD75",
        maTitle: "لحم بقر بالفواكه",
        id: "6",
        maDescription: "مرقد ف عصير الديسير، كيجي المذاق ديالو حلو ومنعش.",
        frTitle: "Bœuf Fuité Secret",
        arTitle: "لحم بقر بالفواكه",
        frDescription:
          "Mariné avec du jus de fruits frais, goût doux et rafraîchissant.",
        title: "秘制果味拌牛肉",
        enTitle: "Secret Fruity Mixed Beef",
      },
      {
        frDescription:
          "Profondément infusé d'arôme de poivre noir, légèrement épicé et appétissant.",
        enTitle: "Black Pepper Mixed Beef",
        title: "黑胡椒拌牛肉",
        frTitle: "Bœuf au Poivre Noir",
        arTitle: "لحم بقر بالفلفل الأسود",
        id: "7",
        maDescription: "منسم بالبزار الكحل، كيجي حار شوية وكحل الشهية.",
        price: "MAD75",
        maTitle: "لحم بقر بالبزار الكحل",
        image: "https://i.ibb.co/nsbt4dxs/faded882cc32.jpg",
        enDescription:
          "Deeply infused with strong black pepper aroma, slightly spicy and appetizing.",
        description: "浓郁的黑胡椒辛香深刻渗入牛肉纹理中，香气浓郁，微辣开胃。",
        arDescription: "متبل بالفلفل الأسود القوي، حار قليلاً ومشهي.",
      },
      {
        arTitle: "لحم بقر كوري حلو وحار",
        frTitle: "Bœuf Doux et Épicé Coréen",
        maDescription:
          "صوص كوري زوين، فيه الحلاوة والملوحة وشوية ديال الحرورة.",
        id: "8",
        enTitle: "Korean Sweet & Spicy Beef",
        title: "韩式甜辣拌牛肉",
        frDescription:
          "Sauce coréenne authentique, sucrée et salée avec une touche parfaite de piquant.",
        enDescription:
          "Authentic Korean rich sauce flavor, sweet and savory with the perfect amount of heat.",
        image: "https://i.ibb.co/TDwrP44X/060f94e4a9e6.jpg",
        arDescription: "صلصة كورية أصلية، مزيج مثالي من الحلو والحار.",
        description: "正统韩式浓郁酱香，咸甜之中带着恰到好处的微辣，十分下饭。",
        maTitle: "لحم بقر كوري حلو وحار",
        price: "MAD75",
      },
      {
        arTitle: "لحم بقر بالليمون والنعناع",
        frTitle: "Bœuf Menthe et Citron",
        maDescription: "لحم منسم بالنعناع والحامض باش كيجي المذاق منعش.",
        id: "9",
        title: "柠檬薄荷拌牛肉",
        enTitle: "Lemon Mint Mixed Beef",
        frDescription:
          "Menthe fraîche et citron pour un bœuf au goût rafraîchissant.",
        enDescription:
          "Fresh mint and lemon perfectly compliment rich beef, providing a cooling and refreshing new flavor.",
        image: "https://i.ibb.co/QxnGjm5/090574c820ed.jpg",
        arDescription: "النعناع والليمون مع اللحم البقري لمذاق منعش.",
        description:
          "清新的薄荷与柠檬完美配合，赋予厚重牛肉清凉解腻的全新风味。",
        maTitle: "لحم بقر بالحامض والنعناع",
        price: "MAD75",
      },
      {
        enDescription:
          "Secret recipe blending traditional herbs and spices, complex and mellow aroma with endless aftertaste.",
        image: "https://i.ibb.co/qtd3qrk/ba8edda33712.jpg",
        description: "结合多种传统中草药与大料秘制，香气复杂而醇厚，回味无穷。",
        arDescription: "وصفة سرية من الأعشاب والتوابل الصينية.",
        maTitle: "لحم بقر بالطريقة الشينوية",
        price: "MAD75",
        arTitle: "لحم بقر بالخلطة الصينية",
        frTitle: "Bœuf Secret Chinois",
        maDescription:
          "لحم بالاعشاب والعطرية ديال الشينوا، كيجي فيه مذاق زوين.",
        id: "10",
        enTitle: "Chinese Secret Mixed Beef",
        title: "中式秘制拌牛肉",
        frDescription: "Recette secrète d'herbes et épices, arôme complexe.",
      },
      {
        enTitle: "Lemon Coconut Mixed Beef",
        title: "柠檬椰浆拌牛肉",
        frDescription:
          "Style asiatique avec lait de coco crémeux et citron acidulé.",
        maDescription: "كوكيز وحامض فلحم زوين، المذاق ديالو واعر.",
        id: "11",
        arTitle: "لحم بقر بالليمون وجوز الهند",
        frTitle: "Bœuf Citron Coco",
        maTitle: "لحم بقر بالحامض والكوك",
        price: "MAD75",
        description:
          "充满东南亚热带风情的风味，椰浆的醇厚奶香加上柠檬的果酸，风味独特。",
        arDescription:
          "يجمع بين حليب جوز الهند الكريمي وحموضة الليمون البقري الفريد.",
        enDescription:
          "Southeast Asian style, pairing creamy coconut milk with lemon acidity for a unique flavor.",
        image: "https://i.ibb.co/ymsvc1jq/687136872d75.jpg",
      },
      {
        arTitle: "لحم بقر بالبصل الأخضر",
        frTitle: "Bœuf Oignons Verts",
        maDescription: "مرقد بالبصلة الخضارية، تيجي بنين بزاف.",
        id: "12",
        enTitle: "Secret Scallion Mixed Beef",
        title: "秘制葱香拌牛肉",
        frDescription:
          "Mariné avec des oignons verts frais, goût d'oignon profond et savoureux.",
        enDescription:
          "Marinated with plenty of fresh scallions, deep onion flavor, classic savory taste.",
        image: "https://i.ibb.co/qtd3qrk/ba8edda33712.jpg",
        arDescription: "متبل بالبصل الأخضر، نكهة كلاسيكية لذيذة.",
        description:
          "采用大量新鲜小葱苗抓拌腌制，葱香深刻融入肉中，经典的咸鲜口味。",
        maTitle: "لحم بقر بالبصلة الخضارية",
        price: "MAD75",
      },
      {
        price: "MAD75",
        maTitle: "ضلوع الغنمي على الطريقة الفرنسية",
        image: "https://i.ibb.co/gMGQMv2N/f5af553a03d4.jpg",
        enDescription:
          "High-quality French lamb chops, soft meat without gamey taste, touched with rosemary.",
        arDescription: "لحم ضأن طري مع لمسة من إكليل الجبل.",
        description:
          "骨肉相连的优质法式小羊排，肉质柔软毫无膻味，带有迷迭香的气息。",
        frDescription:
          "Côtelettes d'agneau tendres sans goût fort, touche de romarin.",
        title: "法式小羊排",
        enTitle: "French Lamb Chops",
        frTitle: "Côtelettes d'Agneau Françaises",
        arTitle: "شرائح لحم الضأن الفرنسية",
        id: "13",
        maDescription: "ضلوع الغنمي فرنسية كيجيو فتيين ومنسمين باليازير.",
      },
      {
        title: "照烧鸡排",
        enTitle: "Teriyaki Chicken Steak",
        frDescription:
          "Poulet rôti à la sauce japonaise, sucré et salé, peau croustillante.",
        maDescription: "دجاج مشوي بصوص يابانية، حلو ومالح مقرمش.",
        id: "14",
        arTitle: "دجاج ترياكي",
        frTitle: "Poulet Teriyaki",
        maTitle: "دجاج ترياكي",
        price: "MAD75",
        description: "日式灵魂酱汁焖烤无骨鸡腿肉，甜咸交织，外皮酥脆微焦。",
        arDescription: "دجاج مشوي بصلصة يابانية، حلو ومالح وجلد مقرمش.",
        enDescription:
          "Roasted boneless chicken thigh with Japanese soul sauce, sweet and savory, crispy skin.",
        image: "https://i.ibb.co/ycNnXnTg/ab986131074e.jpg",
      },
      {
        frDescription:
          "Saveur douce et épicée Orléans classique, croustillant à l'extérieur.",
        title: "奥尔良鸡翅",
        enTitle: "Orleans Chicken Wings",
        frTitle: "Ailes de Poulet Orléans",
        arTitle: "أجنحة الدجاج أورليانز",
        id: "15",
        maDescription:
          "مذاق أورليانز كلاسيكي مقرمش على برا وطري لداخل ، كيعجب كلشي.",
        price: "MAD75",
        maTitle: "جنحين الدجاج أورليانز",
        image: "https://i.ibb.co/dsTM4yX2/f69768866283.jpg",
        enDescription:
          "Popular classic Orleans sweet and spicy flavor, crispy outside and tender inside, suitable for everyone.",
        arDescription:
          "نكهة أورليانز حلوة وحارة كلاسيكية، مقرمشة من الخارج وطريق من الداخل.",
        description: "大众最爱的经典奥尔良甜辣风味，外焦里嫩，老少皆宜。",
      },
      {
        arDescription: "نكهة كورية حلوة وحارة مع دجاج طري وعصيري.",
        description: "浓郁的韩式甜辣风味渗入无骨鸡肉中，咬下去鲜嫩爆汁。",
        enDescription:
          "Rich Korean sweet and spicy flavor penetrates boneless chicken, tender and juicy inside.",
        image: "https://i.ibb.co/ycNnXnTg/ab986131074e.jpg",
        maTitle: "دجاج حلو وحار",
        price: "MAD75",
        maDescription: "طعم كوري حلو وحار فدجاج طري كيطرطق بالبنة.",
        id: "16",
        arTitle: "دجاج حلو وحار",
        frTitle: "Poulet Doux et Épicé",
        title: "甜辣鸡排",
        enTitle: "Sweet & Spicy Chicken Steak",
        frDescription:
          "Style coréen, poulet désossé doux et épicé, tendre et juteux.",
      },
      {
        price: "MAD96",
        maTitle: "كروفيت كبير",
        image:
          "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=1200&q=80",
        enDescription:
          "Daily direct delivery of fresh prawns, firm and bouncy meat, sweet and tempting.",
        arDescription: "روبيان فريش يومي، لحم متماسك ولذيذ.",
        description: "每日直供的生鲜大虾，肉质紧实弹牙，鲜甜诱人。",
        frDescription:
          "Crevettes fraîches livrées tous les jours, chair ferme, douce et attrayante.",
        title: "大虾",
        enTitle: "Jumbo Prawns",
        frTitle: "Grosses Crevettes",
        arTitle: "روبيان جامبو",
        id: "17",
        maDescription: "كروفيت طري كل نهار، اللحم ديالو زوين وبنين.",
      },
      {
        id: "18",
        maDescription: "كيتشوا مزيان، جنابو مقرمشين والمذاق ديالو حلو كالبحر.",
        frTitle: "Bâtonnets de Crabe",
        arTitle: "أصابع السلطعون",
        frDescription:
          "Gris après rôtissage, bords croustillants, apporte une douceur de fruits de mer.",
        title: "蟹棒",
        enTitle: "Crab Sticks",
        arDescription: "مقرمش الأطراف، حلاوة المأكولات البحرية.",
        description: "烤制后自然散开，边缘焦脆，带来丰富的海鲜甜味。",
        image: "https://i.ibb.co/chcyRtQF/655af4099c94.jpg",
        enDescription:
          "Spreads naturally after roasting, crispy edges, brings rich seafood sweetness.",
        price: "46",
        maTitle: "أصابع السوريمي",
      },
      {
        id: "bbq-squid",
        title: "鲜脆鱿鱼圈",
        enTitle: "Fresh Squid Rings",
        frTitle: "Rondelles de Calamar Frais",
        arTitle: "حلقات حبار طازج",
        maTitle: "حلقات كالامار",
        description: "新鲜鱿鱼改刀切圈，烤至金黄焦香，口感脆弹生津。",
        enDescription:
          "Freshly cut squid rings, grilled to golden perfection, crisp and tender.",
        frDescription:
          "Rondelles de calamar fraîchement coupées, grillées à la perfection, croustillantes et tendres.",
        arDescription: "حلقات حبار طازجة، مشوية حتى تصبح ذهبية ومقرمشة.",
        maDescription: "كالامار طري مقطع، مشوي ومقرمش وبنين.",
        price: "MAD96",
        image:
          "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80",
      },
      {
        enDescription:
          "Thick cut fresh zucchini, naturally sweet and refreshing after roasting.",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
        arDescription: "كوسة طازجة مقطعة إلى شرائح سميكة، حلوة وطبيعية.",
        description: "厚切原切西葫芦，烤出水分后天然清甜鲜美解腻。",
        maTitle: "كرعة خضراء",
        price: "MAD31",
        arTitle: "كوسة طازجة",
        frTitle: "Courgette Fraîche",
        maDescription: "كرعة غليضة شوية، حلوة وبنينة ملي كتشوى.",
        id: "19",
        enTitle: "Fresh Zucchini",
        title: "西葫芦",
        frDescription:
          "Courgette coupée en tranches épaisses, douce et naturelle.",
      },
      {
        maTitle: "شومبينيو",
        price: "MAD36",
        description:
          "倒扣炭火慢烤，中心会积满极其鲜美的天然蘑菇原汁，千万别漏掉。",
        arDescription: "مطهو ببطء فوق الفحم، يمتلئ مركزه بعصير الفطر الطبيعي.",
        enDescription:
          "Slow roasted upside down over charcoal, center fills with extremely delicious natural mushroom juice.",
        image: "https://i.ibb.co/0yCCsS8Q/834a58b0cc9d.jpg",
        title: "口蘑",
        enTitle: "Button Mushrooms",
        frDescription:
          "Rôti lentement au charbon de bois, centre rempli de jus de champignons.",
        maDescription: "مشوي على الفاخر، كيجي فيه العصير ديال شومبينيو زوين.",
        id: "20",
        arTitle: "فطر المائدة",
        frTitle: "Champignons de Paris",
      },
      {
        enTitle: "Potato Slices",
        title: "土豆片",
        frDescription:
          "Fines tranches de pommes de terre, bords croustillants, excellentes avec des épices.",
        arTitle: "شرائح البطاطس",
        frTitle: "Tranches de Pomme de Terre",
        maDescription:
          "بطاطا رقيقة بزاف، كتقرمش من الجناب وكتعطي مذاق واعر مع العطرية.",
        id: "21",
        maTitle: "بطاطا مقطعة",
        price: "MAD31",
        enDescription:
          "Thin potato slices, crispy edges when roasted longer, tastes great with dry spice mix.",
        image: "https://i.ibb.co/Fb3C4YxC/db89feb8aece.jpg",
        arDescription: "شرائح رقيقة من البطاطس، حواف مقرمشة مع توابل رائعة.",
        description: "薄如蝉翼的土豆切片，烤久一点边缘焦脆，撒上干碟味道极佳。",
      },
      {
        description: "厚切菠萝片，天然的果酸能化解烤肉的疲倦，香甜可口。",
        arDescription: "شرائح سميكة من الأناناس، تعمل الحموضة على تجديد الحنك.",
        image:
          "https://images.unsplash.com/photo-1587883012610-e3df17d41270?auto=format&fit=crop&w=1200&q=80",
        enDescription:
          "Thick cut pineapple slices, natural fruit acidity refreshes the palate, sweet and tasty.",
        price: "MAD36",
        maTitle: "قطاعي د الاناناس",
        id: "23",
        maDescription: "أناناس مقطع غليض، كيحيد الزفرة ديال اللحم وبنين.",
        frTitle: "Tranches d'Ananas",
        arTitle: "شرائح أناناس",
        frDescription:
          "Tranches épaisses d'ananas, acidité rafraîchissante, douce et savoureuse.",
        enTitle: "Pineapple Slices",
        title: "菠萝片",
      },
      {
        frDescription:
          "Rôtie jusqu'à devenir croustillante à l'extérieur et douce à l'intérieur.",
        enTitle: "Sweet Potato",
        title: "红薯",
        frTitle: "Patate Douce",
        arTitle: "بطاطا حلوة",
        id: "24",
        maDescription: "مشوية حتى كتقرمش من برا، ولداخل كتكون معسلة ورطبة.",
        price: "MAD31",
        maTitle: "بطاطا حلوة",
        image: "https://i.ibb.co/xtF02wGy/35532b12f140.jpg",
        enDescription:
          "Natural sweetener rich in starch, roasted to a crispy outside and soft, sweet inside.",
        description: "富含淀粉的天然甜味剂，烤到外皮微焦干脆，内部软糯香甜。",
        arDescription: "محمصة لتصبح مقرمشة من الخارج وطرية من الداخل.",
      },
      {
        maTitle: "خس",
        price: "MAD26",
        description:
          "必点灵魂包肉生菜，翠绿新鲜，能够完美解除油脂沉淀的厚重感。",
        arDescription: "خس طازج ضروري للف اللحم، مثالي لتخفيف الدسم.",
        enDescription:
          "Essential fresh green lettuce for wrapping meat, perfectly refreshes grease from fat.",
        image:
          "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?auto=format&fit=crop&w=1200&q=80",
        title: "生菜",
        enTitle: "Lettuce",
        frDescription:
          "Laitue fraîche incontournable pour envelopper la viande.",
        maDescription:
          "خص طري ضروري باش تلوي فيه اللحم، كينقص من الشحمة مزيان.",
        id: "25",
        arTitle: "خس",
        frTitle: "Laitue",
      },
      {
        frDescription:
          "Sauces et condiments pour accompagner votre repas barbecue.",
        enTitle: "Condiments / Dips",
        title: "小料",
        frTitle: "Condiments / Sauces",
        arTitle: "التوابل / الصلصات",
        id: "26",
        maDescription: "عطرية وصوص كيزيدو بنة على مشوياتك.",
        price: "MAD0",
        maTitle: "العطرية / الصوص",
        image: "https://i.ibb.co/chFVM201/82f0dad1204a.jpg",
        enDescription:
          "Soulful dipping sauce pairings, adding layers of flavor to your BBQ journey.",
        arDescription: "صلصات تضيف طبقات من النكهة لرحلة الشواء الخاصة بك.",
        description: "灵魂调料搭配，为您的烤肉之旅增添不同层次的风味。",
      },
    ],
    name: "烤肉菜单",
    arName: "قائمة الشواء",
    enName: "BBQ MENU",
  },
  {
    enName: "HOTPOT MENU",
    name: "火锅菜单",
    arName: "قائمة الهوت بوت",
    id: "all-hotpot-menu-halal",
    maName: "قائمة الهوت بوت",
    items: [
      {
        id: "hp1",
        maDescription: "مرق بجوج نكهات، اختار جوج من حار، عادي، ومطيشة.",
        frTitle: "Bouillon aux Deux Saveurs",
        arTitle: "مرق بنكهتين",
        frDescription:
          "Bouillon classique à deux saveurs, choisissez deux parmi épicé, clair et tomate.",
        enTitle: "Dual Flavor Broth",
        title: "鸳鸯锅底",
        description:
          "经典鸳鸯锅，可从麻辣、清汤、番茄中任选两种，一次满足两种口味。",
        arDescription:
          "مرق بنكهتين كلاسيكي، اختر اثنين من الحار والصافي والطماطم.",
        image:
          "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
        enDescription:
          "Classic dual flavor broth, choose any two from spicy, clear, and tomato, satisfying two tastes at once.",
        price: "MAD76",
        maTitle: "مرق بجوج نكهات",
      },
      {
        title: "清汤锅底",
        enTitle: "Clear Broth",
        frDescription:
          "Bouillon mijoté avec des os de bœuf et du poulet, léger et délicieux.",
        maDescription: "مرق طايب على خاطره مع عظام الدجاج واللحم، خفيف وبنين.",
        id: "hp-clear",
        arTitle: "مرق صافي",
        frTitle: "Bouillon Clair",
        maTitle: "مرق عادي",
        price: "MAD66",
        description: "用大骨老鸡熬制的高汤，清淡鲜美，老少皆宜。",
        arDescription: "مرق مطبوخ ببطء مع عظام البقر والدجاج، خفيف ولذيذ.",
        enDescription:
          "Broth slow-cooked with beef bones and old chicken, light and delicious, suitable for all ages.",
        image:
          "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
      },
      {
        id: "hp-squid",
        maDescription: "كالامار طري مقطع، كيتسلق شوية وكيعطي قرمشة.",
        frTitle: "Rondelles de Calamar Frais",
        arTitle: "حلقات حبار طازج",
        frDescription:
          "Rondelles de calamar fraîchement coupées, brièvement ébouillantées, texture croquante.",
        enTitle: "Fresh Squid Rings",
        title: "鲜脆鱿鱼圈",
        description: "新鲜鱿鱼改刀切圈，在锅中汆烫至卷曲即可食用，口感脆弹。",
        arDescription: "حلقات حبار طازجة، مسلوقة قليلاً بقوام مقرمش ومطاطي.",
        image:
          "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80",
        enDescription:
          "Freshly cut squid rings, briefly parboiled until curled, offering a crisp and bouncy texture.",
        price: "MAD96",
        maTitle: "حلقات كالامار",
      },
      {
        id: "hp-lamb-roll",
        maDescription: "غنمي ممتاز مقطع رقيق، فتي كيذوب ف الفم.",
        frTitle: "Rouleaux de Mouton",
        arTitle: "لفائف لحم ضأن",
        frDescription:
          "Rouleaux de mouton premium, viande tendre qui fond dans la bouche.",
        title: "羊肉卷",
        enTitle: "Sliced Mutton Rolls",
        description: "肥瘦均匀的优质羊肉卷，肉质鲜嫩，入口即化，火锅绝配。",
        arDescription:
          "لفائف لحم ضأن فاخرة بتوازن مثالي بين الدهون واللحم، طرية وتذوب في الفم.",
        image:
          "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
        enDescription:
          "Premium mutton rolls with balanced fat and lean, tender meat that melts in your mouth.",
        price: "75",
        maTitle: "رولو دي الغنمي",
      },
      {
        enTitle: "Sliced Chicken Rolls",
        title: "鸡肉卷",
        frDescription:
          "Rouleaux de poulet frais, faibles en matières grasses, tendres et savoureux.",
        maDescription: "دجاج طري مقطع رقيق، مافيهش ليدام بزاف وكيجي بنين.",
        id: "hp-chicken-roll",
        arTitle: "لفائف الدجاج",
        frTitle: "Rouleaux de Poulet",
        maTitle: "رولو دي الدجاج",
        price: "75",
        description: "新鲜鸡腿肉压切成卷，低脂弹牙，鲜香嫩滑，老少皆宜。",
        arDescription:
          "لفائف لحم الدجاج الطازج، قليلة الدهون وطرية، مناسبة للجميع.",
        enDescription:
          "Fresh chicken meat rolls, low fat, chewy and tender, suitable for everyone.",
        image:
          "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80",
      },
      {
        id: "hp-beef-roll",
        maDescription: "بݣري ممتاز مقطع رقيق، دغيا كيطيب وبنين بزاف.",
        frTitle: "Rouleaux de Bœuf",
        arTitle: "لفائف لحم البقر",
        frDescription: "Rouleaux de bœuf de qualité, riche saveur de bœuf.",
        title: "牛肉卷",
        enTitle: "Sliced Beef Rolls",
        arDescription: "لفائف لحم بقر غنية بالنكهة، تطهى في ثوانٍ.",
        description: "精选谷饲牛肉卷，肉香浓郁，涮烫数秒即熟，美味不可阻挡。",
        image:
          "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
        enDescription:
          "Selected grain-fed beef rolls, rich beef flavor, cooks in seconds.",
        price: "75",
        maTitle: "رولو دي البݣري",
      },
      {
        enDescription:
          "Fresh boneless fish fillet cubes, tender, juicy, and flavor-packed.",
        image:
          "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80",
        description: "鲜嫩无骨鱼块，肉质紧实鲜美，涮烫或炙烤均极佳。",
        arDescription: "مكعبات سمك طازجة بدون حسك، طرية ولذيذة.",
        maTitle: "طراف د الحوت",
        price: "44",
        arTitle: "مكعبات سمك",
        frTitle: "Cubes de Poisson",
        maDescription: "طراف د الحوت بلا شوك طريين وبنان بزاف.",
        id: "hp-new-basa",
        enTitle: "Fish Fillet Cubes",
        title: "鱼块",
        frDescription:
          "Cubes de filet de poisson frais sans arêtes, tendres et savoureux.",
      },
      {
        enTitle: "Beef Meatballs",
        title: "牛肉丸子",
        frDescription:
          "Boulettes de bœuf faites à la main, tendres et pleines de jus.",
        arTitle: "كرات لحم البقر",
        frTitle: "Boulettes de Bœuf",
        maDescription: "كرات اللحم البݣري مصنوعة باليد.",
        id: "hp-new-meatball",
        maTitle: "كرات لحم البقر",
        price: "71",
        enDescription: "Hand-beaten beef meatballs, bouncy and juicy.",
        image:
          "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
        arDescription: "كرات لحم بقر يدوية، ممتلئة بالعصارة.",
        description: "手工捶打的牛肉丸，劲道Q弹，咬一口肉汁四溢。",
      },
      {
        enDescription:
          "Porous, perfectly absorbs the delicious flavor of the hotpot broth.",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
        description: "孔隙丰富，完美吸收火锅汤底的鲜美滋味。",
        arDescription: "مسامي، يمتص تماماً النكهة اللذيذة لمرق الهوت بوت.",
        maTitle: "توفو مكونجلي",
        price: "MAD46",
        arTitle: "توفو مجمد",
        frTitle: "Tofu Congelé",
        maDescription: "كيشرب المرق ديال الهوت بوت مزيان حيت فيه مسامات.",
        id: "hp11",
        enTitle: "Frozen Tofu",
        title: "冻豆腐",
        frDescription:
          "Poreux, absorbe parfaitement la délicieuse saveur du bouillon de la fondue.",
      },
      {
        price: "MAD46",
        maTitle: "يوبا طرية",
        arDescription:
          "يوبا طازجة تحتفظ بأغنى رائحة فول الصويا، بقوام ناعم وطري.",
        description: "新鲜制作的腐竹，保留了最浓郁的豆香，口感滑嫩爽口。",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
        enDescription:
          "Freshly made yuba, retaining the richest soy aroma, with a smooth and tender texture.",
        frDescription:
          "Yuba fraîchement préparé, conservant l'arôme de soja le plus riche, texture lisse et tendre.",
        title: "鲜腐竹",
        enTitle: "Fresh Yuba (Tofu Skin)",
        id: "hp18",
        maDescription: "يوبا طرية فيها ريحة الصوجا، بنينة ورطبة.",
        frTitle: "Yuba frais (Peau de tofu)",
        arTitle: "يوبا طازجة (جلد التوفو)",
      },
      {
        arDescription: "فطر أبيض طازج، شرائح، لذيذ وممتلئ بالعصارة.",
        description: "新鲜的白蘑菇，洗净切片，味道鲜美多汁。",
        image:
          "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
        enDescription: "Fresh white mushrooms, sliced, delicious and juicy.",
        price: "MAD36",
        maTitle: "شومبينيو أبيض",
        id: "hp-white-mushroom",
        maDescription: "شومبينيو أبيض طري، بنين وفيه الما.",
        frTitle: "Champignons de Paris",
        arTitle: "فطر أبيض",
        frDescription:
          "Champignons blancs frais, coupés en tranches, délicieux et juteux.",
        title: "新鲜白蘑菇",
        enTitle: "White Button Mushrooms",
      },
      {
        price: "MAD26",
        maTitle: "إندومي",
        description:
          "超人气即食面Indomie，用于火锅最后的收尾，吸收所有汤汁精华，美味无比。",
        arDescription:
          "نودلز الإندومي الشهيرة، مثالية لإنهاء الهوت بوت بامتصاصها لجوهر المرق.",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
        enDescription:
          "The popular Indomie instant noodles, perfect for finishing the hotpot by absorbing all broth essence.",
        frDescription:
          "Nouilles instantanées Indomie populaires, parfaites pour terminer la fondue.",
        title: "火锅泡面 (Indomie)",
        enTitle: "Instant Noodles (Indomie)",
        id: "hp-indomie",
        maDescription: "إندومي، كتشرب المرق كامل وكتجي فنة فالاخير.",
        frTitle: "Nouilles Instantanées (Indomie)",
        arTitle: "نودلز الإندومي",
      },
      {
        price: "34",
        maTitle: "نقانق بقر صغيرة حلال",
        arDescription: "نقانق بقر حلال صغيرة مقرمشة ومليئة بالعصارة.",
        description: "脆皮清真牛肉小香肠，咬下去肉汁满满，火锅必点。",
        image:
          "https://images.unsplash.com/photo-1585325701165-351af916e581?auto=format&fit=crop&w=1200&q=80",
        enDescription:
          "Crispy mini halal beef sausages, bursting with juices in every bite, a hotpot must-have.",
        frDescription:
          "Mini saucisses de bœuf halal croustillantes et juteuses.",
        enTitle: "Mini Halal Beef Sausages",
        title: "清真牛肉小香肠",
        id: "hp-new-mini-sausage",
        maDescription: "نقانق بقر حلال صغيرة مقرمشة وبنينة.",
        frTitle: "Mini Saucisses de Bœuf (Halal)",
        arTitle: "نقانق بقر صغيرة حلال",
      },
      {
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
        enDescription:
          "Sweet and savory crab sticks, a favorite among children.",
        arDescription: "أصابع السلطعون الحلوة واللذيذة، مفضلة لدى الأطفال.",
        description: "一丝一丝的蟹味棒，鲜甜美味，小朋友的最爱。",
        price: "46",
        maTitle: "أصابع السلطعون",
        frTitle: "Bâtonnets de Crabe",
        arTitle: "أصابع السلطعون",
        id: "hp-new-crab-stick",
        maDescription: "أصابع السلطعون للدراري الصغار.",
        frDescription:
          "Bâtonnets de crabe sucrés et savoureux, le favori des enfants.",
        title: "蟹棒",
        enTitle: "Crab Sticks",
      },
      {
        enTitle: "Wood Ear Mushrooms",
        title: "木耳",
        frDescription:
          "Champignons oreille de bois croquants, sains et faibles en calories.",
        arTitle: "فطر أذن الخشب",
        frTitle: "Champignons Oreille de Bois",
        maDescription: "فطر أذن الخشب مقرمش وصحي بزاف.",
        id: "hp-new-wood-ear",
        maTitle: "فطر أذن الخشب",
        price: "36",
        enDescription:
          "Crispy and refreshing wood ear mushrooms, low-calorie and healthy.",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
        description: "脆嫩爽口的黑木耳，低卡健康，解腻首选。",
        arDescription: "فطر أذن الخشب مقرمش وصحي، منخفض السعرات الحرارية.",
      },
      {
        frDescription: "Pommes de terre finement tranchées.",
        enTitle: "Sliced Potatoes",
        title: "土豆片",
        frTitle: "Pommes de Terre Tranchées",
        arTitle: "بطاطس مقطعة",
        id: "hp-new-potato",
        maDescription: "بطاطيس مقطعة رقيقة.",
        price: "16",
        maTitle: "بطاطس مقطعة",
        image:
          "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
        enDescription:
          "Thin-sliced potatoes, can be crunchy or soft depending on cooking time.",
        arDescription: "شرائح بطاطس رقيقة.",
        description: "薄切土豆片，可脆可面，由你决定煮多久。",
      },
      {
        maTitle: "بطاطا حلوة",
        price: "18",
        description: "厚切红薯块，煮透后香甜软糯。",
        arDescription: "قطع بطاطا حلوة سميكة، ناعمة وحلوة عند طبخها.",
        enDescription: "Thick-cut sweet potatoes, sweet and soft when boiled.",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
        enTitle: "Sweet Potatoes",
        title: "红薯",
        frDescription:
          "Gros morceaux de patate douce, doux et moelleux après cuisson.",
        maDescription: "بطاطا حلوة كذوب فالفم من بعد طيابها.",
        id: "hp-new-sweet-potato",
        arTitle: "بطاطا حلوة",
        frTitle: "Patates Douces",
      },
      {
        id: "hp-white-radish",
        title: "白萝卜",
        enTitle: "White Radish",
        frTitle: "Radis Blanc",
        arTitle: "فجل أبيض",
        maTitle: "فجل أبيض",
        price: "18",
        image:
          "https://images.unsplash.com/photo-1590779033100-9f60a05a013d?auto=format&fit=crop&w=800&q=80",
      },
      {
        frTitle: "Laitue",
        arTitle: "خس",
        id: "hp-new-lettuce",
        maDescription: "خس مقرمش زوين فالهوت بوت.",
        frDescription: "Laitue tendre et juteuse.",
        title: "生菜",
        enTitle: "Lettuce",
        image:
          "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?auto=format&fit=crop&w=1200&q=80",
        enDescription:
          "Lettuce that needs only a quick dip in the broth, crisp and juicy.",
        description: "稍微烫一下就能吃的生菜，脆嫩多汁。",
        arDescription: "خس مقرمش ومليء بالعصارة.",
        price: "26",
        maTitle: "خس",
      },
      {
        price: "21",
        maTitle: "بروكلي",
        arDescription: "قرنبيط أخضر صحي ومغذي.",
        description: "营养丰富的西兰花，吸满汤汁饱满好吃。",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
        enDescription: "Nutritious broccoli florets, absorbs soup beautifully.",
        frDescription: "Fleurs de brocoli très nutritives.",
        enTitle: "Broccoli",
        title: "西兰花",
        id: "hp-new-broccoli",
        maDescription: "بروكلي عامر بالفيتامينات.",
        frTitle: "Brocoli",
        arTitle: "بروكلي",
      },
      {
        enDescription:
          "Fresh cauliflower florets, great when cooked soft to soak up flavors.",
        image:
          "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
        description: "新鲜散花菜，煮得软烂入味更佳。",
        arDescription: "قرنبيط أبيض طازج.",
        maTitle: "شيفلور",
        price: "20",
        arTitle: "قرنبيط",
        frTitle: "Chou-fleur",
        maDescription: "شيفلور كيشرب المرقة وكيجي بنين.",
        id: "hp-new-cauliflower",
        title: "花菜",
        enTitle: "Cauliflower",
        frDescription:
          "Fleurs de chou-fleur frais, parfaites pour absorber les saveurs.",
      },
      {
        arDescription: "نودلز بطاطا حلوة مطاطية وناعمة.",
        description: "纯红薯制作的圆粉条，顺滑弹牙，不容易断。",
        enDescription:
          "Chewy and bouncy round sweet potato noodles, smooth and hard to break.",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
        maTitle: "نودلز بطاطا حلوة",
        price: "51",
        maDescription: "نودلز بالبطاطا الحلوة.",
        id: "hp-new-sp-noodles",
        arTitle: "نودلز بطاطا حلوة",
        frTitle: "Nouilles de Patate Douce",
        enTitle: "Sweet Potato Noodles",
        title: "红薯粉",
        frDescription: "Nouilles rondes de patate douce.",
      },
      {
        maTitle: "كعك الأرز",
        price: "24",
        arDescription: "كعك الأرز الكوري الطري.",
        description: "软糯拉丝的韩国年糕片，不仅顶饱还很好吃。",
        enDescription:
          "Soft and chewy Korean rice cakes, very filling and delicious.",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
        title: "年糕",
        enTitle: "Rice Cakes",
        frDescription: "Gâteaux de riz coréens, doux et moelleux.",
        maDescription: "كعك الأرز كوري، رطبل وكذوب.",
        id: "hp-new-rice-cake",
        arTitle: "كعك الأرز",
        frTitle: "Gâteaux de Riz",
      },
      {
        id: "hp-doupi",
        title: "豆皮",
        enTitle: "Bean Curd Sheet (Doupi)",
        frTitle: "Feuille de Tofu",
        arTitle: "جلد التوفو",
        maTitle: "يوبا طرية",
        price: "28",
        description: "薄如纸张的天然豆皮，久煮不烂，吸满火锅红汤鲜味。",
        enDescription:
          "Thin natural bean curd sheets, holds up well in hotpot, absorbing broth flavors.",
        frDescription:
          "Feuilles de tofu fines et naturelles, absorbent parfaitement le bouillon.",
        arDescription: "شرائح توفو رقيقة وطبيعية، تمتص المرق بشكل ممتاز.",
        maDescription: "يوبا طرية كتشرب المرقة.",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
      },
      {
        id: "hp-doufusi",
        title: "豆腐丝",
        enTitle: "Shredded Tofu (Doufusi)",
        frTitle: "Tofu En Lanières",
        arTitle: "توفو بشرائح",
        maTitle: "توفو بشرائح",
        price: "26",
        description: "细丝豆腐干，爽口柔韧，涮烫后满口豆香。",
        enDescription:
          "Finely shredded tofu, springy and flavorful after boiling.",
        frDescription:
          "Lanières de tofu finement coupées, savoureuses et souples.",
        arDescription: "شرائح توفو رفيعة، طرية ولذيذة في الهوت بوت.",
        maDescription: "توفو بشرائح بنين فالهوت بوت.",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
      },
      {
        id: "hp-muercai",
        title: "木耳菜",
        enTitle: "Malabar Spinach (Muercai)",
        frTitle: "Épinard de Malabar",
        arTitle: "سبانخ مالابار",
        maTitle: "سبانخ طرية",
        price: "24",
        description: "鲜嫩黏滑的木耳菜，清热润燥，火锅绿叶菜佳品。",
        enDescription:
          "Fresh Malabar spinach, tender and silky, rich in vitamins.",
        frDescription:
          "Épinard de Malabar frais, tendre et riche en nutriments.",
        arDescription: "سبانخ مالابار طازجة وطرية ومغذية.",
        maDescription: "سبانخ طرية و زوينة فالهوت بوت.",
        image:
          "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?auto=format&fit=crop&w=1200&q=80",
      },
      {
        id: "hp-xiaobaicai",
        title: "小白菜",
        enTitle: "Baby Chinese Cabbage",
        frTitle: "Petit Chou Chinois",
        arTitle: "ملفوف صيني صغير",
        maTitle: "كرمب صيني صغير",
        price: "22",
        description: "水嫩脆爽的小白菜，绿叶清甜，涮烫数秒即鲜美爽口。",
        enDescription:
          "Tender baby Chinese cabbage, sweet, crisp and refreshing.",
        frDescription: "Petit chou chinois tendre, sucré et croquant.",
        arDescription: "ملفوف صيني صغير طازج ومقرمش.",
        maDescription: "كرمب صيني مقرمش وبنين.",
        image:
          "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?auto=format&fit=crop&w=1200&q=80",
      },
    ],
    frName: "MENU FONDUE",
  },
  {
    id: "cat-main-drinks",
    name: "主食 & 饮品",
    enName: "MAINS & DRINKS",
    frName: "PLATS & BOISSONS",
    arName: "الأطباق الرئيسية والمشروبات",
    maName: "الأطباق الرئيسية والمشروبات",
    items: [
      {
        id: "main-rice-bowl",
        title: "拌饭",
        enTitle: "Rice Bowl",
        frTitle: "Bol de Riz",
        arTitle: "وعاء الأرز",
        maTitle: "بول الرز",
        price: "MAD75",
        description: "新鲜蔬菜、裙带菜与香米饭，可选口味。",
        enDescription:
          "Fresh vegetables, wakame seaweed and fragrant rice. Choose your flavor.",
        image:
          "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=800&q=80",
        addons: [
          {
            id: "rice-teriyaki-chicken",
            name: "照烧鸡肉",
            enName: "Teriyaki Chicken",
            price: 0,
          },
          {
            id: "rice-filet",
            name: "菲力牛肉",
            enName: "Beef Tenderloin",
            price: 0,
          },
          {
            id: "rice-korean",
            name: "韩式甜辣牛肉",
            enName: "Korean Spicy Beef",
            price: 0,
          },
          {
            id: "rice-sausage",
            name: "香烤牛肉香肠",
            enName: "Grilled Beef Sausage",
            price: 0,
          },
          {
            id: "rice-secret",
            name: "中式秘制牛肉",
            enName: "Chinese Secret Beef",
            price: 0,
          },
          {
            id: "rice-teriyaki-premium",
            name: "尊享照烧牛肉",
            enName: "Premium Beef Teriyaki",
            price: 0,
          },
        ],
      },
      {
        id: "main-dumpling-dry",
        title: "干饺",
        enTitle: "Dry Dumplings",
        frTitle: "Raviolis Secs",
        arTitle: "زلابية جافة",
        maTitle: "زلابية ناشفة",
        price: "MAD75",
        description: "手工牛肉馅饺子，干拌吃法，更能品尝牛肉原汁原味。",
        enDescription:
          "Handmade halal beef dumplings served dry, to savor the original flavor of the beef.",
        image:
          "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=800&q=80",
        addons: [
          {
            id: "dumpling-dry-large",
            name: "大份",
            enName: "Large Portion",
            price: 15,
          },
        ],
      },
      {
        id: "main-dumpling-pan",
        title: "煎饺",
        enTitle: "Pan-Fried Dumplings",
        frTitle: "Raviolis Grillés",
        arTitle: "زلابية مقلية",
        maTitle: "زلابية مقلية",
        price: "MAD75",
        description: "外皮金黄酥脆，馅料鲜嫩多汁，经典美味。",
        enDescription:
          "Crispy outside, juicy and tender inside, pan-fried to perfection.",
        image:
          "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&q=80",
        addons: [
          {
            id: "dumpling-pan-large",
            name: "大份",
            enName: "Large Portion",
            price: 15,
          },
        ],
      },
      {
        id: "main-salade-fraiche",
        title: "鲜绿田园沙拉",
        enTitle: "Fresh Garden Salad",
        frTitle: "Salade Fraîche",
        arTitle: "سلطة طازجة",
        maTitle: "شلاظة طرية",
        price: "MAD45",
        description:
          "生菜、黄瓜、番茄、西兰花、青椒、牛油果和水波蛋，淋上优质橄榄油，撒上海盐与黑胡椒，轻卡高纤。",
        enDescription:
          "Lettuce, cucumber, tomato, broccoli, green bell pepper, avocado, and poached egg, seasoned with olive oil, salt, and black pepper.",
        frDescription:
          "Laitue, concombre, tomate, brocoli, poivron vert, avocat et œuf poché, assaisonnés d'huile d'olive, sel et poivre.",
        arDescription:
          "خس، خيار، طماطم، بروكلي، فلفل أخضر، أفوكادو، وبيض مسلوق، متبلة بزيت الزيتون، الملح والفلفل الأسود.",
        maDescription:
          "خس، خيار، طماطم، بروكلي، فلفل أخضر، أفوكادو، وبيض مسلوق، متبلة بزيت الزيتون، الملح والفلفل الأسود.",
        image:
          "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",
      },
      {
        id: "main-crevettes-orange",
        title: "香橙大虾沙拉",
        enTitle: "Orange Shrimp Salad",
        frTitle: "Salade de Crevettes à l'Orange",
        arTitle: "سلطة الروبيان بالبرتقال",
        maTitle: "شلاظة كروفيت بالليمون",
        price: "MAD55",
        description:
          "鲜美大虾配以清甜橙子、多汁番茄和牛油果，撒上少许黑胡椒，酸甜开胃，清新活力。",
        enDescription:
          "Fresh shrimp served with tomatoes, avocado, and orange, seasoned with a touch of black pepper.",
        frDescription:
          "Crevettes fraîches servies avec des tomates, avocat et orange, assaisonnées d'une touche de poivre noir.",
        arDescription:
          "روبيان طازج يقدم مع الطماطم، الأفوكادو، والبرتقال، متبل بلمسة من الفلفل الأسود.",
        maDescription:
          "روبيان طازج يقدم مع الطماطم، الأفوكادو، والبرتقال، متبل بلمسة من الفلفل الأسود.",
        image:
          "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80",
      },
      {
        maTitle: "كوكا باردة",
        price: "10",
        enDescription:
          "Classic carbonated drink, ice-cold and thirst-quenching, perfect partner for hotpot and BBQ.",
        image:
          "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=1200&q=80",
        arDescription: "مشروب غازي كلاسيكي، مثلج ومروي للعطش.",
        description: "经典碳酸饮料，冰爽解渴，火锅烤肉绝佳拍档。",
        title: "冰镇可乐",
        enTitle: "Iced Cola",
        frDescription: "Boisson gazeuse classique, glacée et désaltérante.",
        arTitle: "كولا مثلجة",
        frTitle: "Cola Glacé",
        maDescription:
          "كوكا كولا باردة ومنعشة، كتمشي مزيان مع الشوا والهوت بوت.",
        id: "dk1",
      },
      {
        price: "MAD8",
        maTitle: "سبرايت بارد",
        arDescription:
          "صودا منعشة بنكهة الليمون، مبردة حتى النخاع، تجلب طعمًا محفزًا.",
        description: "清爽柠檬味汽水，冰凉透心，带来刺激口感。",
        image:
          "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=1200&q=80",
        enDescription:
          "Refreshing lemon-flavored soda, chilled to the core, bringing a stimulating taste.",
        frDescription:
          "Soda rafraîchissant au citron, glacé à cœur, apportant un goût stimulant.",
        title: "冰雪碧",
        enTitle: "Iced Sprite",
        id: "dk4",
        maDescription: "مونادا منعشة بنكهة الحامض، باردة ومزيانة للعطش.",
        frTitle: "Sprite Glacé",
        arTitle: "سبرايت مثلج",
      },
      {
        id: "dk-mirinda-plus",
        title: "美年达plus",
        enTitle: "Mirinda Plus",
        frTitle: "Mirinda Plus",
        arTitle: "ميريندا بلس",
        maTitle: "ميريندا بلوس",
        price: "15",
        description: "橙味美年达，活力气泡，果香浓郁。",
        enDescription:
          "Orange flavored Mirinda, vibrant bubbles, rich fruity flavor.",
        frDescription:
          "Mirinda saveur orange, bulles vibrantes, riche saveur fruitée.",
        arDescription:
          "ميريندا بنكهة البرتقال، فقاعات حيوية，نكهة فاكهية غنية.",
        maDescription: "مونادا ميريندا ليمون，باردة ومنعشة وفيا الكاز.",
        image:
          "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=1200&q=80",
      },
      {
        id: "dk-7up",
        title: "七喜",
        enTitle: "7-Up",
        frTitle: "7-Up",
        arTitle: "سفن أب",
        maTitle: "سفن أب",
        price: "13",
        description: "清爽柠檬汽水，激爽无比，冰镇极佳。",
        enDescription:
          "Refreshing lemon-lime soda, extremely crisp and perfectly chilled.",
        frDescription:
          "Soda rafraîchissant citron-citron vert, extrêmement croustillant et parfaitement glacé.",
        arDescription:
          "صودا الليمون واللايم المنعشة，مقرمشة للغاية ومبردة تمامًا.",
        maDescription: "مونادا سفن أب منعشة ديال الحامض，باردة ومزيانة.",
        image:
          "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=80",
      },
      {
        id: "dk-pepsi",
        title: "百事可乐",
        enTitle: "Pepsi",
        frTitle: "Pepsi",
        arTitle: "بيبسي",
        maTitle: "بيبسي",
        price: "13",
        description: "经典百事可乐，激爽解渴，美味分享。",
        enDescription:
          "Classic Pepsi, exciting and thirst-quenching, delicious to share.",
        frDescription:
          "Pepsi classique, excitant et désaltérant, délicieux à partager.",
        arDescription: "بيبسي كلاسيك，مثير ومروي للعطش，لذيذ للمشاركة.",
        maDescription: "بيبسي كلاسيك باردة ومنعشة，كتمشي مزيان مع الماكلة.",
        image:
          "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=1200&q=80",
      },
      {
        id: "dk-lipton-tea",
        title: "利普顿凉茶",
        enTitle: "Lipton Herbal Tea",
        frTitle: "Thé Glacé Lipton",
        arTitle: "شاي لبتون المثلج",
        maTitle: "أتاي ليبتون بارد",
        price: "25",
        description: "清凉去火，利普顿精心调配，甘甜解渴。",
        enDescription:
          "Cooling and refreshing herbal tea, carefully blended by Lipton, sweet and thirst-quenching.",
        frDescription:
          "Thé à base de plantes rafraîchissant, soigneusement mélangé par Lipton, doux et désaltérant.",
        arDescription:
          "شاي عشبي مبرد ومنعش，تم مزجه بعناية بواسطة لبتون，حلو ومروي للعطش.",
        maDescription: "أتاي ليبتون بارد ومنعش，كيروي العطش ومزيان للصحة.",
        image:
          "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=1200&q=80",
      },
      {
        id: "dk-mirinda",
        title: "美年达",
        enTitle: "Mirinda",
        frTitle: "Mirinda",
        arTitle: "ميريندا",
        maTitle: "ميريندا",
        price: "10",
        description: "经典橙味美年达汽水，甜美果香。",
        enDescription:
          "Classic orange flavored Mirinda soda, sweet and fruity.",
        frDescription: "Soda Mirinda classique à l'orange, doux et fruité.",
        arDescription: "صودا ميريندا الكلاسيكية بنكهة البرتقال，حلوة وفاكهية.",
        maDescription: "مونادا ميريندا ليمون كلاسيكية，حلوة ومنعشة.",
        image:
          "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=1200&q=80",
      },
      {
        id: "dk-pepsi-zero",
        title: "百事可乐无糖",
        enTitle: "Pepsi Zero Sugar",
        frTitle: "Pepsi Sans Sucre",
        arTitle: "بيبسي دايت خالي من السكر",
        maTitle: "بيبسي بلا سكر",
        price: "13",
        description: "劲爽百事，无糖零卡，健康美味无负担。",
        enDescription:
          "Invigorating Pepsi, zero sugar and zero calories, healthy and delicious with no burden.",
        frDescription:
          "Pepsi revigorant, sans sucre and sans calories, sain and délicieux sans fardeau.",
        arDescription:
          "بيبسي منعش，خالي من السكر وخالي من السعرات الحرارية，صحي ولذيذ دون أي عبء.",
        maDescription: "بيبسي دايت بلا سكر وبلا كالوري，منعشة ومزيانة للصحة.",
        image:
          "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=1200&q=80",
      },
    ],
  },
  {
    id: "cat-skewers",
    name: "烤串",
    enName: "GRILLED SKEWERS",
    frName: "BROCHETTES",
    arName: "أسياخ مشوية",
    maName: "بروشيت مشوي",
    items: [
      {
        id: "skw-lamb-plain",
        title: "原味羊肉串",
        enTitle: "Plain Lamb Skewer",
        frTitle: "Brochette d'Agneau",
        arTitle: "سيخ لحم ضأن",
        maTitle: "بروشيت لحم ضأن",
        price: "MAD10",
        description: "原味羊肉串，炭火烤制，外焦里嫩。",
        enDescription:
          "Plain lamb skewer, charcoal-grilled, crisp outside and tender inside.",
        frDescription:
          "Brochette d'agneau, grillée au charbon, croustillante à l'extérieur et tendre à l'intérieur.",
        arDescription:
          "سيخ لحم ضأن مشوي على الفحم، مقرمش من الخارج وطري من الداخل.",
        maDescription:
          "بروشيت لحم ضأن مشوي، قاعد على الفحم، قشرو مقرمش والداخل طري.",
        image: "",
      },
      {
        id: "skw-lamb-cumin",
        title: "孜然羊肉串",
        enTitle: "Cumin Lamb Skewer",
        frTitle: "Brochette d'Agneau au Cumin",
        arTitle: "سيخ لحم ضأن بالكمون",
        maTitle: "بروشيت لحم ضأن بالكمون",
        price: "MAD10",
        description: "撒满孜然与辣椒粉，香气四溢。",
        enDescription: "Coated with cumin and chili, aromatic and bold.",
        frDescription:
          "Enrobée de cumin et de piment, aromatique et audacieuse.",
        arDescription: "مغطى بالكمون والفلفل الحار، عطري وجريء.",
        maDescription: "مغشي بالكمون والفلفل، عطري وجريء.",
        image: "",
      },
      {
        id: "skw-beef-korean",
        title: "韩式烤牛肉串",
        enTitle: "Korean Beef Skewer",
        frTitle: "Brochette de Bœuf Coréen",
        arTitle: "سيخ لحم بقر كوري",
        maTitle: "بروشيت لحم بقر كوري",
        price: "MAD10",
        description: "韩式甜辣酱腌制，甜香微辣。",
        enDescription:
          "Marinated in Korean sweet chili sauce, sweet and mildly spicy.",
        frDescription:
          "Marinée dans une sauce coréenne sucrée et piquante, douce et légèrement épicée.",
        arDescription: "متبل بصلصة كورية حلوة وحارة، حلو وخفيف الحرارة.",
        maDescription: "مرقد فصوص كورية حلوة وحارة، حلو وخفيف الحرورة.",
        image: "",
      },
      {
        id: "skw-beef-chinese",
        title: "中式烤牛肉串",
        enTitle: "Chinese Beef Skewer",
        frTitle: "Brochette de Bœuf Chinoise",
        arTitle: "سيخ لحم بقر صيني",
        maTitle: "بروشيت لحم بقر صيني",
        price: "MAD10",
        description: "中式秘制酱料，经典烧烤风味。",
        enDescription: "Chinese secret marinade, classic barbecue flavor.",
        frDescription: "Marinade secrète chinoise, saveur barbecue classique.",
        arDescription: "تتبيلة صينية سرية، نكهة شواء كلاسيكية.",
        maDescription: "مريناد صيني سري، نكهة الشواية كلاسيكية.",
        image: "",
      },
      {
        id: "skw-beef-blackpepper",
        title: "黑胡椒牛肉串",
        enTitle: "Black Pepper Beef Skewer",
        frTitle: "Brochette de Bœuf au Poivre Noir",
        arTitle: "سيخ لحم بقر بالفلفل الأسود",
        maTitle: "بروشيت لحم بقر بالفلفل الأسود",
        price: "MAD10",
        description: "现磨黑胡椒调味，香辣提鲜。",
        enDescription: "Seasoned with freshly ground black pepper.",
        frDescription: "Assaisonnée de poivre noir fraîchement moulu.",
        arDescription: "متبل بالفلفل الأسود المطحون طازجاً.",
        maDescription: "منسم بالفلفل الأسود المطحون طازج.",
        image: "",
      },
      {
        id: "skw-beef-short-rib",
        title: "原味牛肋条串",
        enTitle: "Beef Short Rib Skewer",
        frTitle: "Brochette de Plat de Côtes",
        arTitle: "سيخ ضلوع بقر",
        maTitle: "بروشيت ضلوع البقر",
        price: "MAD10",
        description: "选用牛肋条，口感厚实鲜嫩。",
        enDescription: "Made with beef short rib, rich and tender.",
        frDescription: "Fait de plat de côtes de bœuf, riche et tendre.",
        arDescription: "مصنوع من ضلوع البقر، غني وطري.",
        maDescription: "مصنوع من ضلوع البقر، غني وطري.",
        image: "",
      },
      {
        id: "skw-beef-garlic",
        title: "蒜香牛肉串",
        enTitle: "Garlic Beef Skewer",
        frTitle: "Brochette de Bœuf à l'Ail",
        arTitle: "سيخ لحم بقر بالثوم",
        maTitle: "بروشيت لحم بقر بالثوم",
        price: "MAD10",
        description: "浓郁蒜香，烤至金黄。",
        enDescription: "Rich garlic aroma, grilled to golden perfection.",
        frDescription: "Arôme d'ail riche, grillé à la perfection.",
        arDescription: "رائحة ثوم غنية، مشوي إلى الكمال.",
        maDescription: "ريحة الثوم غنية، مشوي بالكمال.",
        image: "",
      },
      {
        id: "skw-chicken-teriyaki",
        title: "照烧鸡肉串",
        enTitle: "Teriyaki Chicken Skewer",
        frTitle: "Brochette de Poulet Teriyaki",
        arTitle: "سيخ دجاج ترياكي",
        maTitle: "بروشيت دجاج ترياكي",
        price: "MAD10",
        description: "日式照烧酱汁，甜咸适中。",
        enDescription: "Japanese teriyaki glaze, balanced sweet and savory.",
        frDescription: "Glaçage teriyaki japonais, équilibré sucré-salé.",
        arDescription: "تزجيج ترياكي ياباني، متوازن بين الحلو والمالح.",
        maDescription: "زجاج ترياكي ياباني، متوازن بين الحلو والمالح.",
        image: "",
      },
      {
        id: "skw-chicken-orleans",
        title: "奥尔良烤鸡串",
        enTitle: "Orleans Chicken Skewer",
        frTitle: "Brochette de Poulet Orléans",
        arTitle: "سيخ دجاج أورليانز",
        maTitle: "بروشيت دجاج أورليان",
        price: "MAD10",
        description: "奥尔良风味腌制，鲜香嫩滑。",
        enDescription: "Orleans-style marinade, juicy and fragrant.",
        frDescription: "Marinade façon Orléans, juteuse et parfumée.",
        arDescription: "تتبيلة أورليانز، طرية وعطرة.",
        maDescription: "مريناد أورليان، طري وعطر.",
        image: "",
      },
      {
        id: "skw-chicken-wing",
        title: "原味鸡翅串",
        enTitle: "Plain Chicken Wing Skewer",
        frTitle: "Brochette d'Ailes de Poulet",
        arTitle: "سيخ أجنحة دجاج",
        maTitle: "بروشيت جنحين الدجاج",
        price: "MAD10",
        description: "整只鸡翅串烤，皮脆肉嫩。",
        enDescription:
          "Whole chicken wings on skewers, crispy skin and tender meat.",
        frDescription:
          "Ailes de poulet entières, peau croustillante et viande tendre.",
        arDescription: "أجنحة دجاج كاملة، جلد مقرمش ولحم طري.",
        maDescription: "جنحين الدجاج كاملين، القشرة مقرمشة واللحم طري.",
        image: "",
      },
      {
        id: "skw-seafood-crab-stick",
        title: "蟹肉棒串",
        enTitle: "Crab Stick Skewer",
        frTitle: "Brochette de Bâtonnets de Crabe",
        arTitle: "سيخ أصابع السلطعون",
        maTitle: "بروشيت أصابع السلطعون",
        price: "MAD10",
        description: "香烤蟹肉棒，鲜甜爽口。",
        enDescription: "Grilled crab sticks, sweet and fresh.",
        frDescription: "Bâtonnets de crabe grillés, sucrés et frais.",
        arDescription: "أصابع سلطعون مشوية، حلوة وطازجة.",
        maDescription: "أصابع السلطعون مشوية، حلوة وطازجة.",
        image: "",
      },
      {
        id: "skw-seafood-shrimp",
        title: "香烤大虾串",
        enTitle: "Grilled Prawn Skewer",
        frTitle: "Brochette de Crevettes",
        arTitle: "سيخ روبيان مشوي",
        maTitle: "بروشيت جمبري",
        price: "MAD10",
        description: "大虾去壳烤制，弹牙鲜美。",
        enDescription: "Peeled and grilled prawns, springy and flavorful.",
        frDescription:
          "Crevettes décortiquées grillées, fermes et savoureuses.",
        arDescription: "روبيان مقشر مشوي، متماسك ولذيذ.",
        maDescription: "جمبري مقشر مشوي، متماسك ولذيذ.",
        image: "",
      },
      {
        id: "skw-seafood-squid",
        title: "鲜烤鱿鱼串",
        enTitle: "Grilled Squid Skewer",
        frTitle: "Brochette de Calmar",
        arTitle: "سيخ حبار مشوي",
        maTitle: "بروشيت كالامار",
        price: "MAD10",
        description: "鲜嫩鱿鱼，烤出焦香。",
        enDescription: "Fresh squid, grilled to a smoky finish.",
        frDescription: "Calmar frais, grillé avec une finition fumée.",
        arDescription: "حبار طازج، مشوي بنكهة مدخنة.",
        maDescription: "كالامار طازج، مشوي بنكهة مدخنة.",
        image: "",
      },
      {
        id: "skw-veg-zucchini",
        title: "烤西葫芦",
        enTitle: "Grilled Zucchini",
        frTitle: "Brochette de Courgette",
        arTitle: "سيخ كوسة",
        maTitle: "بروشيت كرعة",
        price: "MAD10",
        description: "清甜西葫芦，清爽解腻。",
        enDescription: "Sweet zucchini, light and refreshing.",
        frDescription: "Courgette sucrée, légère et rafraîchissante.",
        arDescription: "كوسة حلوة، خفيفة ومنعشة.",
        maDescription: "كرعة حلوة، خفيفة ومنعشة.",
        image: "",
      },
      {
        id: "skw-veg-potato",
        title: "烤土豆",
        enTitle: "Grilled Potato",
        frTitle: "Brochette de Pomme de Terre",
        arTitle: "سيخ بطاطس",
        maTitle: "بروشيت بطاطا",
        price: "MAD10",
        description: "外皮焦香，内里软糯。",
        enDescription: "Crisp outside, soft inside.",
        frDescription: "Croustillante à l'extérieur, moelleuse à l'intérieur.",
        arDescription: "مقرمشة من الخارج وناعمة من الداخل.",
        maDescription: "مقرمشة من برا وناعمة من جوا.",
        image: "",
      },
      {
        id: "skw-veg-sweet-potato",
        title: "烤红薯",
        enTitle: "Grilled Sweet Potato",
        frTitle: "Brochette de Patate Douce",
        arTitle: "سيخ بطاطا حلوة",
        maTitle: "بروشيت بطاطا حلوة",
        price: "MAD10",
        description: "香甜软糯，天然好滋味。",
        enDescription: "Naturally sweet and soft.",
        frDescription: "Naturellement sucrée et moelleuse.",
        arDescription: "حلوة وناعمة بشكل طبيعي.",
        maDescription: "حلوة وناعمة بشكل طبيعي.",
        image: "",
      },
      {
        id: "skw-veg-mushroom",
        title: "烤蘑菇",
        enTitle: "Grilled Mushroom",
        frTitle: "Brochette de Champignons",
        arTitle: "سيخ فطر",
        maTitle: "بروشيت شومبينيو",
        price: "MAD10",
        description: "蘑菇鲜香，汁水饱满。",
        enDescription: "Juicy mushrooms with a rich umami flavor.",
        frDescription: "Champignons juteux à la riche saveur umami.",
        arDescription: "فطر طري بنكهة أومامي غنية.",
        maDescription: "شومبينيو طري بنكهة أومامي غنية.",
        image: "",
      },
      {
        id: "skw-veg-wood-ear",
        title: "烤木耳",
        enTitle: "Grilled Wood Ear",
        frTitle: "Brochette d'Oreilles de Judas",
        arTitle: "سيخ فطر أذن الخشب",
        maTitle: "بروشيت فطر الخشب",
        price: "MAD10",
        description: "爽脆木耳，烧烤风味十足。",
        enDescription: "Crisp wood ear fungus with a smoky char.",
        frDescription: "Oreilles de Judas croustillantes au léger goût fumé.",
        arDescription: "فطر أذن الخشب مقرمش بنكهة مدخنة خفيفة.",
        maDescription: "فطر الخشب مقرمش بنكهة مدخنة خفيفة.",
        image: "",
      },
      {
        id: "skw-veg-eggplant",
        title: "烤茄子",
        enTitle: "Grilled Eggplant",
        frTitle: "Brochette d'Aubergine",
        arTitle: "سيخ باذنجان",
        maTitle: "بروشيت باذنجان",
        price: "MAD10",
        description: "茄子软滑，蘸酱更美味。",
        enDescription: "Silky eggplant, delicious with sauce.",
        frDescription: "Aubergine soyeuse, délicieuse avec la sauce.",
        arDescription: "باذنجان ناعم، لذيذ مع الصلصة.",
        maDescription: "باذنجان ناعم، لذيذ مع الصلصة.",
        image: "",
      },
      {
        id: "skw-side-bread",
        title: "烤面包",
        enTitle: "Grilled Bread",
        frTitle: "Brochette de Pain",
        arTitle: "سيخ خبز",
        maTitle: "بروشيت خبز",
        price: "MAD10",
        description: "炭火烤面包，外脆内软。",
        enDescription: "Charcoal-grilled bread, crisp outside and soft inside.",
        frDescription:
          "Pain grillé au charbon, croustillant dehors, moelleux dedans.",
        arDescription: "خبز مشوي على الفحم، مقرمش من الخارج وطري من الداخل.",
        maDescription: "خبز مشوي، مقرمش من برا وطري من جوا.",
        image: "",
      },
      {
        id: "skw-side-pineapple",
        title: "烤菠萝",
        enTitle: "Grilled Pineapple",
        frTitle: "Brochette d'Ananas",
        arTitle: "سيخ أناناس",
        maTitle: "بروشيت أناناس",
        price: "MAD10",
        description: "炙烤菠萝，甜酸清爽。",
        enDescription: "Grilled pineapple, sweet and tangy.",
        frDescription: "Ananas grillé, sucré et acidulé.",
        arDescription: "أناناس مشوي، حلو وحامض.",
        maDescription: "أناناس مشوي، حلو وحامض.",
        image: "",
      },
    ],
  },
];

export function mergeAndOrderCategories(
  existingCats: any[],
  initialCats: any[] = INITIAL_MENU_CATEGORIES,
  deletedItemIds: string[] = [],
) {
  const REMOVED_TITLES = new Set([
    "手工宽粉",
    "香肠片",
    "香菇",
    "上海青",
    "菠菜",
    "油麦菜",
  ]);
  const REMOVED_IDS = new Set([
    "22",
    "hp10",
    "hp-new-sausage-slice",
    "hp-new-shiitake",
    "hp-new-shanghai-bok",
    "hp-spinach",
    "hp-new-achoy",
    // 主食与饮品合并；拌饭、饺子只保留一个，其余改为可选加项
    "main-poulet-teriyaki",
    "main-filet-boeuf",
    "main-boeuf-coreen",
    "main-saucisses-grillees",
    "main-secret-chinois",
    "main-boeuf-coco-citron",
    "main-boeuf-oignons-citron",
    "main-beef-teriyaki-premium",
    "main-dumpling-soup",
    "main-dumpling-soup-small",
    "main-pan-fried-dumplings",
    "main-pan-fried-dumplings-small",
    "main-dumpling",
  ]);

  // 旧的「主食 & 沙拉」「饮品分类」合并为一个分类（云端旧数据迁移）
  const LEGACY_MERGED_CAT_IDS = ["cat-staples", "all-drinks-menu"];
  const MERGED_CAT_ID = "cat-main-drinks";
  const migrateLegacyCategories = (cats: any[]) => {
    if (!Array.isArray(cats)) return cats;
    const legacy = cats.filter(
      (c) => c && LEGACY_MERGED_CAT_IDS.includes(c.id),
    );
    if (legacy.length === 0) return cats;
    const mergedItems = legacy.flatMap((c) => c.items || []);
    // 若「主食 & 饮品」分类已存在，旧分类的菜品已在其中，直接丢弃旧分类，
    // 避免再生成一个 id 相同的重复分类（重复分类被误删后会被软删除永久隐藏）。
    const hasMain = cats.some((c) => c && c.id === MERGED_CAT_ID);
    const out: any[] = [];
    let placed = false;
    for (const c of cats) {
      if (c && LEGACY_MERGED_CAT_IDS.includes(c.id)) {
        if (hasMain) continue;
        if (!placed) {
          out.push({
            id: MERGED_CAT_ID,
            name: "主食 & 饮品",
            items: mergedItems,
          });
          placed = true;
        }
      } else {
        out.push(c);
      }
    }
    return out;
  };
  existingCats = migrateLegacyCategories(existingCats);

  // 紫菜包饭 / 寿司：保留原菜品（含图片），**仅在新数据缺少价格时**补默认价 MAD50，
  // 并确保「大份 +25」加项存在。
  // 曾无条件写入 price: "MAD50"，导致每次读取都把后台改过的价格打回默认值。
  if (Array.isArray(existingCats)) {
    const isKimbapTitle = (t: any) =>
      typeof t === "string" && t.replace(/\s/g, "") === "紫菜包饭/寿司";
    existingCats = existingCats.map((c) => ({
      ...c,
      items: (c.items || []).map((i: any) => {
        if (!isKimbapTitle(i?.title)) return i;
        const hasPrice =
          i?.price !== undefined &&
          i?.price !== null &&
          String(i.price).trim() !== "";
        const existingAddons = Array.isArray(i?.addons) ? i.addons : [];
        const hasLarge = existingAddons.some(
          (a: any) => a?.id === "kimbap-large" || a?.name === "大份",
        );
        return {
          ...i,
          price: hasPrice ? i.price : "MAD50",
          addons: hasLarge
            ? existingAddons
            : [
                {
                  id: "kimbap-large",
                  name: "大份",
                  enName: "Large Portion",
                  price: 25,
                },
                ...existingAddons,
              ],
        };
      }),
    }));
  }

  const deletedSet = new Set(
    (Array.isArray(deletedItemIds) ? deletedItemIds : [])
      .filter(Boolean)
      .map((id) => String(id).trim().toLowerCase()),
  );

  // REMOVED_TITLES 只作用于系统默认菜品（避免误删用户自定义的同名菜品）
  const isItemRemoved = (item: any, isInitial = false) => {
    if (!item) return true;
    if (item.id && REMOVED_IDS.has(String(item.id))) return true;
    if (isInitial && item.title && REMOVED_TITLES.has(item.title)) return true;
    if (item.id && deletedSet.has(String(item.id).trim().toLowerCase()))
      return true;
    if (item.title && deletedSet.has(String(item.title).trim().toLowerCase()))
      return true;
    if (item.name && deletedSet.has(String(item.name).trim().toLowerCase()))
      return true;
    return false;
  };

  const isCatRemoved = (cat: any) => {
    if (!cat) return true;
    if (cat.id && deletedSet.has(String(cat.id).trim().toLowerCase()))
      return true;
    if (cat.name && deletedSet.has(String(cat.name).trim().toLowerCase()))
      return true;
    if (cat.title && deletedSet.has(String(cat.title).trim().toLowerCase()))
      return true;
    return false;
  };

  if (!Array.isArray(existingCats) || existingCats.length === 0) {
    return initialCats
      .filter((c) => !isCatRemoved(c))
      .map((c) => ({
        ...c,
        items: (c.items || []).filter((i: any) => !isItemRemoved(i, true)),
      }));
  }

  const existingCatMap = new Map(existingCats.map((c) => [c.id, c]));
  const initialCatMap = new Map(initialCats.map((c) => [c.id, c]));

  const resultCats: any[] = [];

  // 1. Process existing categories in their saved order
  existingCats.forEach((existingCat) => {
    if (isCatRemoved(existingCat)) return;

    const initialCat = initialCatMap.get(existingCat.id);
    if (!initialCat) {
      // Custom category created by user
      const items = (existingCat.items || []).filter(
        (i: any) => !isItemRemoved(i),
      );
      resultCats.push({ ...existingCat, items });
      return;
    }

    const existingItems = (existingCat.items || []).filter(
      (i: any) => !isItemRemoved(i),
    );
    const initialItems = (initialCat.items || []).filter(
      (i: any) => !isItemRemoved(i, true),
    );
    const initialItemMap = new Map(initialItems.map((i: any) => [i.id, i]));
    const existingItemIds = new Set(existingItems.map((i: any) => i.id));
    const existingItemTitles = new Set(
      existingItems
        .map((i: any) => (i.title || i.name || "").trim().toLowerCase())
        .filter(Boolean),
    );

    // First, map over existing items to preserve their order
    const mergedItems = existingItems.map((existingItem: any) => {
      const initialItem: any = initialItemMap.get(existingItem.id);
      if (!initialItem) return existingItem; // Custom user item

      const isOldBasa =
        existingItem.title === "巴沙鱼" ||
        existingItem.id === "hp-new-basa" ||
        existingItem.title === "汤饺" ||
        existingItem.title === "汤饺 (小份)" ||
        existingItem.title === "干饺" ||
        existingItem.title === "煎饺";

      return {
        ...initialItem,
        ...existingItem,
        title: isOldBasa
          ? initialItem.title
          : existingItem.title || initialItem.title,
        enTitle: isOldBasa
          ? initialItem.enTitle
          : existingItem.enTitle || initialItem.enTitle,
        frTitle: isOldBasa
          ? initialItem.frTitle
          : existingItem.frTitle || initialItem.frTitle,
        arTitle: isOldBasa
          ? initialItem.arTitle
          : existingItem.arTitle || initialItem.arTitle,
        maTitle: isOldBasa
          ? initialItem.maTitle
          : existingItem.maTitle || initialItem.maTitle,
        description: isOldBasa
          ? initialItem.description
          : existingItem.description || initialItem.description,
        enDescription: isOldBasa
          ? initialItem.enDescription
          : existingItem.enDescription || initialItem.enDescription,
        frDescription: isOldBasa
          ? initialItem.frDescription
          : existingItem.frDescription || initialItem.frDescription,
        arDescription: isOldBasa
          ? initialItem.arDescription
          : existingItem.arDescription || initialItem.arDescription,
        maDescription: isOldBasa
          ? initialItem.maDescription
          : existingItem.maDescription || initialItem.maDescription,
        image: existingItem.image || initialItem.image,
      };
    });

    // Then, append any NEW initial items that aren't in existingItems AND aren't removed/deleted
    initialItems.forEach((initialItem: any) => {
      const initialTitle = (initialItem.title || initialItem.name || "")
        .trim()
        .toLowerCase();
      if (
        !existingItemIds.has(initialItem.id) &&
        !existingItemTitles.has(initialTitle) &&
        !isItemRemoved(initialItem, true)
      ) {
        mergedItems.push(initialItem);
      }
    });

    resultCats.push({
      ...existingCat,
      items: mergedItems,
    });
  });

  // 2. Process initial categories that were missing in existingCats
  initialCats.forEach((initialCat: any) => {
    if (!existingCatMap.has(initialCat.id) && !isCatRemoved(initialCat)) {
      resultCats.push({
        ...initialCat,
        items: (initialCat.items || []).filter(
          (i: any) => !isItemRemoved(i, true),
        ),
      });
    }
  });

  return resultCats;
}

/**
 * 剔除「主食 & 饮品」分类及其内置菜品在 deletedItemIds 中的软删除标记。
 *
 * 背景：历史上 migrateLegacyCategories 会在已存在合并分类的情况下再生成一个
 * id 相同的重复分类，老板删除该重复分类时，handleDeleteCategory 会把分类 id 与
 * 全部菜品 id/title 记入 deletedItemIds，导致合并分类永久无法恢复。
 * 修复重复分类 bug 后，仍需清掉已写入的软删除标记，分类才会重新出现。
 * 幂等：标记已清理时结果与原数组一致。
 */
export function stripMainDrinksDeletedIds(deletedItemIds: string[]): string[] {
  const cat = INITIAL_MENU_CATEGORIES.find((c) => c.id === "cat-main-drinks");
  if (!cat) return deletedItemIds;
  const protectedIds = new Set<string>();
  const add = (v: unknown) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim().toLowerCase();
    if (s) protectedIds.add(s);
  };
  add(cat.id);
  add(cat.name);
  add((cat as { title?: string }).title);
  (cat.items || []).forEach((i: any) => {
    add(i.id);
    add(i.title);
    add(i.name);
  });
  return (deletedItemIds || []).filter(
    (id) => !protectedIds.has(String(id).trim().toLowerCase()),
  );
}
