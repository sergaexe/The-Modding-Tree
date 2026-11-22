// ---------- Кейс-кликер: данные и вспомогательные функции ----------
// Функции вынесены за пределы слоя, чтобы движок не вызывал их каждый тик.

var RARITIES = [
    {id: "common",    name: "Обычный",     color: "#b0b0b0", value: 6,    weight: 60},
    {id: "uncommon",  name: "Необычный",   color: "#5cb85c", value: 20,   weight: 25},
    {id: "rare",      name: "Редкий",      color: "#4a90e2", value: 80,   weight: 10},
    {id: "epic",      name: "Эпический",   color: "#b05cf0", value: 400,  weight: 4},
    {id: "legendary", name: "Легендарный", color: "#f5a623", value: 3000, weight: 1},
]

function caseCost() {
    let cost = new Decimal(25)
    if (hasUpgrade("c", 11)) cost = cost.times(0.8)
    return cost
}

function sellMult() {
    let mult = new Decimal(1)
    if (hasUpgrade("c", 12)) mult = mult.times(1.5)
    return mult
}

function rarityWeights() {
    // Улучшение "Счастливая монетка" удваивает шанс редких и выше
    return RARITIES.map((r, i) => (i >= 2 && hasUpgrade("c", 13)) ? r.weight * 2 : r.weight)
}

function pickRarity() {
    let weights = rarityWeights()
    let total = weights.reduce((a, b) => a + b, 0)
    let roll = Math.random() * total
    for (let i = 0; i < RARITIES.length; i++) {
        roll -= weights[i]
        if (roll < 0) return RARITIES[i]
    }
    return RARITIES[0]
}

function itemValue(rarity) {
    return new Decimal(rarity.value).times(sellMult())
}

function invCount() {
    let n = 0
    for (let r of RARITIES) n += player.c.inv[r.id]
    return n
}

function invValue() {
    let sum = new Decimal(0)
    for (let r of RARITIES) sum = sum.add(itemValue(r).times(player.c.inv[r.id]))
    return sum
}

function openCase() {
    let cost = caseCost()
    if (player.points.lt(cost)) return false
    player.points = player.points.sub(cost)
    let rarity = pickRarity()
    player.c.inv[rarity.id] += 1
    player.c.opened += 1
    player.c.last = rarity.id
    return true
}

function sellAll() {
    let sum = invValue()
    if (sum.lte(0)) return
    player.points = player.points.add(sum)
    for (let r of RARITIES) player.c.inv[r.id] = 0
}

function rarityLabel(r) {
    return `<span style="color:${r.color}; font-weight:bold">${r.name}</span>`
}

function lastText() {
    let r = RARITIES.find(x => x.id === player.c.last)
    if (!r) return "Открой первый кейс!"
    return `Последний дроп: ${rarityLabel(r)} (${format(itemValue(r))} монет)`
}

function inventoryText() {
    let lines = RARITIES.map(r =>
        `${rarityLabel(r)}: ${formatWhole(player.c.inv[r.id])} × ${format(itemValue(r))}`
    )
    return `<b>Инвентарь</b><br>${lines.join("<br>")}<br>Всего при продаже: <b>${format(invValue())}</b> монет`
}

// ---------- Слой ----------

addLayer("c", {
    name: "cases",
    symbol: "К",
    position: 0,
    row: 0,
    color: "#f5a623",
    resource: "предметов",
    type: "none",
    layerShown() { return true },

    startData() { return {
        unlocked: true,
        points: new Decimal(0),
        opened: 0,
        inv: {common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0},
        last: "",
        timer: 0,
    }},

    hotkeys: [
        {key: "o", description: "O: открыть кейс", onPress() { openCase() }},
        {key: "s", description: "S: продать всё", onPress() { sellAll() }},
    ],

    update(diff) {
        if (hasUpgrade("c", 22)) sellAll()
        if (hasUpgrade("c", 21)) {
            // Один кейс в секунду, пока хватает монет
            player.c.timer = Math.min(player.c.timer + diff, 20)
            let n = 0
            while (player.c.timer >= 1 && n < 20) {
                if (!openCase()) { player.c.timer = 1; break }
                player.c.timer -= 1
                n++
            }
        }
    },

    tabFormat: [
        ["display-text", function() { return `Кейсов открыто: <b>${formatWhole(player.c.opened)}</b>` }],
        "blank",
        ["row", [["clickable", 11], ["clickable", 12]]],
        "blank",
        ["display-text", function() { return lastText() }],
        "blank",
        ["display-text", function() { return inventoryText() }],
        "blank",
        "upgrades",
    ],

    clickables: {
        11: {
            title: "Открыть кейс",
            display() { return "Цена: " + formatWhole(caseCost()) + " монет" },
            canClick() { return player.points.gte(caseCost()) },
            onClick() { openCase() },
            style: {"width": "180px", "height": "110px", "margin": "5px"},
        },
        12: {
            title: "Продать всё",
            display() { return "Выручка: " + format(invValue()) + " монет" },
            canClick() { return invCount() > 0 },
            onClick() { sellAll() },
            style: {"width": "180px", "height": "110px", "margin": "5px"},
        },
    },

    upgrades: {
        11: {
            title: "Оптовая закупка",
            description: "Кейсы стоят на 20% дешевле.",
            cost: new Decimal(150),
            currencyDisplayName: "монет",
            currencyInternalName: "points",
        },
        12: {
            title: "Острый нож",
            description: "Предметы продаются на 50% дороже.",
            cost: new Decimal(400),
            currencyDisplayName: "монет",
            currencyInternalName: "points",
        },
        13: {
            title: "Счастливая монетка",
            description: "Шанс редких и более ценных предметов x2.",
            cost: new Decimal(1200),
            currencyDisplayName: "монет",
            currencyInternalName: "points",
        },
        21: {
            title: "Автооткрытие",
            description: "Открывает один кейс в секунду, пока хватает монет.",
            cost: new Decimal(4000),
            currencyDisplayName: "монет",
            currencyInternalName: "points",
        },
        22: {
            title: "Автопродажа",
            description: "Все предметы продаются автоматически.",
            cost: new Decimal(8000),
            currencyDisplayName: "монет",
            currencyInternalName: "points",
        },
    },
})
