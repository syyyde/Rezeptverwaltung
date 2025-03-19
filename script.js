// Globale Variablen für die Rezeptdatenbank, Einkaufsliste und verknüpfte Rezepte
let rezepte = []; // Liste aller Rezepte
let einkaufsliste = {}; // Konsolidierte Einkaufsliste (nach Zutaten)
let verwendeteRezepte = {}; // Verknüpfte Rezepte mit Anzahl (z. B. {"Nudelauflauf": 3})

// Rezepte aus Supabase laden
async function ladeRezepte() {
    let { data, error } = await supabase.from('rezepte').select('*');
    if (error) console.error("Fehler beim Laden der Rezepte:", error);
    else rezepte = data || [];
}

// Hinzugefügte Rezepte aus Supabase laden
async function ladeVerwendeteRezepte() {
    let { data, error } = await supabase.from('einkaufsliste_rezepte').select('*');
    if (error) console.error("Fehler beim Laden der Einkaufsliste:", error);
    else verwendeteRezepte = data.reduce((acc, item) => {
        acc[item.rezeptname] = item.anzahl;
        return acc;
    }, {});
}

// Einkaufsliste berechnen
function berechneEinkaufsliste() {
    let einkaufsliste = {};
    for (const [rezeptName, anzahl] of Object.entries(verwendeteRezepte)) {
        const rezept = rezepte.find(r => r.name === rezeptName);
        if (rezept) {
            rezept.zutaten.forEach(({ name, menge, einheit }) => {
                if (!einkaufsliste[name]) einkaufsliste[name] = { menge: 0, einheit };
                einkaufsliste[name].menge += menge * anzahl;
            });
        }
    }
    return einkaufsliste;
}

async function speichereRezepte() {
    await supabase.from('rezepte').delete().neq('id', 0); // Alle alten Rezepte löschen
    const daten = rezepte.map(rezept => ({
        name: rezept.name,
        zutaten: rezept.zutaten, // Kein JSON.stringify() mehr nötig
        anleitung: rezept.anleitung
    }));
    await supabase.from('rezepte').insert(daten);
}

async function rezeptSpeichern(event) {
    event.preventDefault();
    const rezeptName = document.getElementById('rezept-name').value;
    const zutatenText = document.getElementById('zutaten').value;
    const anleitung = document.getElementById('anleitung').value;

    const zutaten = zutatenText.split(',').map(item => {
        const [name, menge, einheit] = item.split(':').map(el => el.trim());
        return { name, menge: parseFloat(menge), einheit };
    });

    rezepte.push({
        name: rezeptName,
        zutaten, // JSON direkt speichern
        anleitung
    });

    await speichereRezepte();
    zeigeBenachrichtigung(`"${rezeptName}" wurde hinzugefügt!`);
    navigate('rezepte');
}

async function rezeptZurEinkaufslisteHinzufügen(rezeptName) {
    verwendeteRezepte[rezeptName] = (verwendeteRezepte[rezeptName] || 0) + 1;

    await supabase
        .from('einkaufsliste_rezepte')
        .upsert({ rezeptname: rezeptName, anzahl: verwendeteRezepte[rezeptName] });

    einkaufsliste = berechneEinkaufsliste(); 
    zeigeBenachrichtigung(`"${rezeptName}" wurde zur Einkaufsliste hinzugefügt!`);
    navigate('rezepte'); // 🔹 Ansicht aktualisieren
}

// Rezept aus Einkaufsliste entfernen
async function rezeptAusEinkaufslisteEntfernen(rezeptName) {
    if (!verwendeteRezepte[rezeptName]) {
        console.warn(`⚠ Rezept "${rezeptName}" ist nicht in der Einkaufsliste.`);
        return;
    }

    verwendeteRezepte[rezeptName] -= 1;

    let error;
    if (verwendeteRezepte[rezeptName] <= 0) {
        delete verwendeteRezepte[rezeptName];

        // 🔥 Rezept aus Supabase entfernen
        ({ error } = await supabase
            .from('einkaufsliste_rezepte')
            .delete()
            .eq('rezeptname', rezeptName));
    } else {
        // 🔥 Rezept-Count in Supabase aktualisieren
        ({ error } = await supabase
            .from('einkaufsliste_rezepte')
            .update({ anzahl: verwendeteRezepte[rezeptName] })
            .eq('rezeptname', rezeptName));
    }

    if (error) {
        console.error("❌ Fehler beim Entfernen aus Supabase:", error);
        zeigeBenachrichtigung("❌ Fehler beim Entfernen!");
        return;
    }

    einkaufsliste = berechneEinkaufsliste(); // ✅ Einkaufsliste aktualisieren
    zeigeBenachrichtigung(`"${rezeptName}" wurde entfernt!`);
    navigate('einkaufsliste');
}


// Funktion mit "Einkaufsliste leeren"-Button verknüpfen
async function einkaufslisteLeeren() {
    if (!confirm("Bist du sicher, dass du die gesamte Einkaufsliste löschen möchtest?")) return;
    await supabase.from('einkaufsliste_rezepte').delete().neq('id', 0); // ❌ Hier war noch die alte Tabelle "einkaufsliste"
    
    verwendeteRezepte = {}; // ✅ Verwendete Rezepte leeren
    einkaufsliste = {}; // ✅ Einkaufsliste zurücksetzen
    zeigeBenachrichtigung("Die Einkaufsliste wurde geleert!");
    navigate('einkaufsliste');
}

async function ladeDaten() {
    await ladeRezepte();
    await ladeVerwendeteRezepte();
    einkaufsliste = berechneEinkaufsliste(); // ✅ Einkaufsliste direkt berechnen!
    navigate('rezepte'); 
}

// Funktion für Toast
function zeigeBenachrichtigung(nachricht) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = nachricht;

    container.appendChild(toast);

    // Nach 3 Sekunden ausblenden und entfernen
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500); // Nach Fade-Out löschen
    }, 2000);
}

// Funktion zur Navigation zwischen den verschiedenen Ansichten
function navigate(section, extra = null) {
    const content = document.getElementById('content');

    if (section === 'rezepte') {
        content.innerHTML = `
            <h2>Rezepte</h2>
            <p>Klicke auf ein Rezept, um es anzusehen oder zu bearbeiten:</p>
            <div class="rezepte-container">
                ${rezepte.map(rezept => `
                    <div class="rezept-item">
                        <span class="rezept-name" onclick="zeigeRezept('${rezept.name}')">${rezept.name}</span>
                        <button class="add-button" onclick="rezeptZurEinkaufslisteHinzufügen('${rezept.name}')">+</button>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (section === 'einkaufsliste') {
        content.innerHTML = `
            <h2>Einkaufsliste</h2>
            <ul>
                ${Object.entries(einkaufsliste).map(([name, details]) => `
                    <li>
                        <label for="check-${name}" id="label-${name}" style="flex: 1;">${name}: ${details.menge} ${details.einheit}</label>
                        <input type="checkbox" id="check-${name}" onchange="markiereZutat('${name}')">
                    </li>
                `).join('')}
            </ul>
            <h3>Hinzugefügte Rezepte:</h3>
            <div class="rezepte-container">
                ${Object.entries(verwendeteRezepte).map(([rezeptName, anzahl]) => `
                    <div class="rezept-item">
                        <span class="rezept-name" onclick="zeigeRezept('${rezeptName}')">${rezeptName} (x${anzahl})</span>
                        <button class="remove-button" onclick="rezeptAusEinkaufslisteEntfernen('${rezeptName}')">-</button>
                    </div>
                `).join('')}
            </div><br>
            <button class="clear-button" onclick="einkaufslisteLeeren()">🗑 Einkaufsliste leeren</button>
            <button class="share-button" onclick="einkaufslisteTeilen()">📤 Einkaufsliste teilen</button>
        `;
    } else if (section === 'rezept-hinzufügen') {
        content.innerHTML = `
            <h2>Neues Rezept hinzufügen</h2>
            <form onsubmit="rezeptSpeichern(event)">
                <label for="rezept-name">Rezeptname:</label>
                <input type="text" id="rezept-name" required>
                <label for="zutaten">Zutaten (Name:Menge:Einheit, mit Komma trennen):</label>
                <textarea id="zutaten" required></textarea>
                <label for="anleitung">Anleitung:</label>
                <textarea id="anleitung" required></textarea>
                <button type="submit">Rezept hinzufügen</button>
            </form>
        `;
    } else if (section === 'rezept-details' && extra) {
        // Rezeptdetails anzeigen
        const rezept = rezepte.find(r => r.name === extra);
        if (rezept) {
            content.innerHTML = `
              <h2>${rezept.name}</h2>
              <h3>Zutaten:</h3>
              <ul>
                ${rezept.zutaten.map(zutat => `
                  <li>${zutat.name}: ${zutat.menge} ${zutat.einheit}</li>
                `).join('')}
              </ul>
              <h3>Anleitung:</h3>
              <p>${decodeURIComponent(rezept.anleitung).replace(/\n/g, '<br>')}</p>
              <div style="display: flex; gap: 1rem;">
                <button class="delete-button" onclick="rezeptLöschen('${rezept.name}')">Löschen</button>
                <button onclick="rezeptBearbeiten('${rezept.name}')">Bearbeiten</button>
                <button onclick="navigate('rezepte')">Zurück</button>
              </div>
            `;
        }
      } else if (section === 'rezept-bearbeiten' && extra) {
        // Rezept bearbeiten
        const rezept = rezepte.find(r => r.name === extra);
        if (rezept) {
            content.innerHTML = `
                <h2>${rezept.name} bearbeiten</h2>
                <form onsubmit="rezeptAktualisieren(event, '${rezept.name}')">
                    <label for="rezept-name">Rezeptname:</label>
                    <input type="text" id="rezept-name" value="${rezept.name}" required>
                    <label for="zutaten">Zutaten (Name:Menge:Einheit, mit Komma trennen):</label>
                    <textarea id="zutaten" required>${rezept.zutaten.map(z => `${z.name}:${z.menge}:${z.einheit}`).join(', ')}</textarea>
                    <label for="anleitung">Anleitung:</label>
                    <textarea id="anleitung">${decodeURIComponent(rezept.anleitung)}</textarea>
                    <button type="submit">Speichern</button>
                </form>
            `;
        }
      }
    }

// Funktion: Rezeptdetails anzeigen
function zeigeRezept(rezeptName) {
    navigate('rezept-details', rezeptName);
}

// Funktion: Rezept bearbeiten anzeigen
function rezeptBearbeiten(rezeptName) {
    navigate('rezept-bearbeiten', rezeptName);
}

// Funktion: Rezept speichern
async function rezeptSpeichern(event) {
    event.preventDefault();
    const rezeptName = document.getElementById('rezept-name').value;
    const zutatenText = document.getElementById('zutaten').value;
    const anleitung = document.getElementById('anleitung').value;

    const zutaten = zutatenText.split(',').map(item => {
        const [name, menge, einheit] = item.split(':').map(el => el.trim());
        return { name, menge: parseFloat(menge), einheit };
    });

    rezepte.push({
        name: rezeptName,
        zutaten,
        anleitung: encodeURIComponent(anleitung)
    });

    await speichereRezepte();
    zeigeBenachrichtigung(`"${rezeptName}" wurde hinzugefügt!`);
    navigate('rezepte');
}

// Funktion: Rezept aktualisieren (nach dem Bearbeiten speichern)
async function rezeptAktualisieren(event, altesName) {
    event.preventDefault();
    const rezeptName = document.getElementById('rezept-name').value;
    const zutatenText = document.getElementById('zutaten').value;
    const anleitung = document.getElementById('anleitung').value;

    const zutaten = zutatenText.split(',').map(item => {
        const [name, menge, einheit] = item.split(':').map(el => el.trim());
        return { name, menge: parseFloat(menge), einheit };
    });

    const rezeptIndex = rezepte.findIndex(r => r.name === altesName);
    if (rezeptIndex >= 0) {
        rezepte[rezeptIndex] = {
            name: rezeptName,
            zutaten,
            anleitung: encodeURIComponent(anleitung)
        };
        await speichereRezepte();
        zeigeBenachrichtigung(`"${altesName}" wurde aktualisiert!`);
        navigate('rezepte');
    }
}

// Funktion: Zutat als gekauft markieren
function markiereZutat(name) {
    const checkbox = document.getElementById(`check-${name}`);
    const label = document.getElementById(`label-${name}`);

    if (checkbox.checked) {
        label.classList.add('checked');
    } else {
        label.classList.remove('checked');
    }
}

// Funktion: Rezept löschen
async function rezeptLöschen(rezeptName) {
    if (!confirm(`Bist du sicher, dass du "${rezeptName}" löschen möchtest?`)) {
        return;
    }

    // Einkaufsliste vor dem Löschen des Rezepts aktualisieren
    aktualisiereEinkaufslisteNachLoeschen(rezeptName);

    const index = rezepte.findIndex(r => r.name === rezeptName);
    if (index >= 0) {
        rezepte.splice(index, 1);
        await speichereRezepte(); // 🔹 Jetzt auch in Supabase speichern!
        zeigeBenachrichtigung(`"${rezeptName}" wurde gelöscht!`);
        navigate('rezepte');
    }
}

// Einkaufsliste nach Rezept-Löschung aktualisieren + in Supabase speichern
async function aktualisiereEinkaufslisteNachLoeschen(rezeptName) {
    if (verwendeteRezepte[rezeptName]) {
        const rezept = rezepte.find(r => r.name === rezeptName);
        if (rezept) {
            rezept.zutaten.forEach(zutat => {
                if (einkaufsliste[zutat.name]) {
                    einkaufsliste[zutat.name].menge -= zutat.menge;
                    if (einkaufsliste[zutat.name].menge <= 0) {
                        delete einkaufsliste[zutat.name];
                    }
                }
            });
        }
        delete verwendeteRezepte[rezeptName];
        zeigeBenachrichtigung(`"${rezeptName}" wurde aus der Einkaufsliste entfernt!`);
        navigate('einkaufsliste');
    }
}

// Einkaufsliste teilen (fix: Buttons nur einmal hinzufügen)
function einkaufslisteTeilen() {
    let text = "🛒 Meine Einkaufsliste:\n\n";
    
    Object.entries(einkaufsliste).forEach(([name, details]) => {
        text += `- ${name}: ${details.menge} ${details.einheit}\n`;
    });

    const encodedText = encodeURIComponent(text);
    const whatsappLink = `https://api.whatsapp.com/send?text=${encodedText}`;
    const mailLink = `mailto:?subject=Meine Einkaufsliste&body=${encodedText}`;

    // 🔹 Verhindern, dass die Buttons mehrfach hinzugefügt werden
    let shareBox = document.getElementById('share-box');
    if (!shareBox) {
        shareBox = document.createElement('div');
        shareBox.id = 'share-box';
        shareBox.className = 'share-box';
        shareBox.innerHTML = `
            <button onclick="window.open('${whatsappLink}', '_blank')">📱 WhatsApp</button>
            <button onclick="window.open('${mailLink}', '_blank')">📧 E-Mail</button>
        `;
        document.getElementById('content').appendChild(shareBox);
    }
}

// Beim Laden der Seite die gespeicherten Daten abrufen
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM geladen, initialisiere Supabase...");
    
    const supabaseUrl = "https://crlccetkaainclufdzqh.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNybGNjZXRrYWFpbmNsdWZkenFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzODcxODIsImV4cCI6MjA1Nzk2MzE4Mn0.u8NCm4V_z_iQowm84uNn97BZK67fS7WNMx6ARA1m0Ks";
    
    window.supabase = supabase.createClient(supabaseUrl, supabaseKey); // ⬅ Supabase global setzen

    console.log("Supabase erfolgreich initialisiert:", supabase);
    
    ladeDaten(); // ⬅ Lade erst jetzt die Daten!
    // Standard-Ansicht beim Start
    navigate('rezepte');
});


