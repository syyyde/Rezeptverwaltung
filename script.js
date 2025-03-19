// Globale Variablen für die Rezeptdatenbank, Einkaufsliste und verknüpfte Rezepte
let rezepte = []; // Liste aller Rezepte
let einkaufsliste = {}; // Konsolidierte Einkaufsliste (nach Zutaten)
let verwendeteRezepte = {}; // Verknüpfte Rezepte mit Anzahl (z. B. {"Nudelauflauf": 3})

const firebaseConfig = {
    apiKey: "DEIN_API_KEY",
    authDomain: "rezeptverwaltung-55b10.firebaseapp.com",
    databaseURL: "https://rezeptverwaltung-55b10-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "rezeptverwaltung-55b10",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function speichereDatenOnline() {
    db.ref("einkaufsliste").set(einkaufsliste);
}

function ladeDatenOnline() {
    db.ref("einkaufsliste").on("value", (snapshot) => {
        einkaufsliste = snapshot.val() || {};
        navigate("einkaufsliste");
    });
}

// Funktion zum Laden der gespeicherten Daten
function ladeDaten() {
    const gespeicherteRezepte = localStorage.getItem("rezepte");
    const gespeicherteEinkaufsliste = localStorage.getItem("einkaufsliste");
    const gespeicherteVerwendeteRezepte = localStorage.getItem("verwendeteRezepte");

    rezepte = gespeicherteRezepte ? JSON.parse(gespeicherteRezepte) : [];
    einkaufsliste = gespeicherteEinkaufsliste ? JSON.parse(gespeicherteEinkaufsliste) : {};
    verwendeteRezepte = gespeicherteVerwendeteRezepte ? JSON.parse(gespeicherteVerwendeteRezepte) : {};
}

// Funktion zum Speichern der Daten
function speichereDaten() {
    localStorage.setItem("rezepte", JSON.stringify(rezepte));
    localStorage.setItem("einkaufsliste", JSON.stringify(einkaufsliste));
    localStorage.setItem("verwendeteRezepte", JSON.stringify(verwendeteRezepte));
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
function rezeptSpeichern(event) {
    event.preventDefault();
    const rezeptName = document.getElementById('rezept-name').value;
    const zutatenText = document.getElementById('zutaten').value;
    const anleitung = document.getElementById('anleitung').value;

    const zutaten = zutatenText.split(',').map(item => {
        const [name, menge, einheit] = item.split(':').map(el => el.trim());
        return { name, menge: parseFloat(menge), einheit };
    });

    // Zeilenumbrüche in der Anleitung korrekt speichern
    rezepte.push({
        name: rezeptName,
        zutaten,
        anleitung: encodeURIComponent(anleitung) // Speichert Zeilenumbrüche sicher
    });

    speichereDaten();
    zeigeBenachrichtigung(`"${rezeptName}" wurde hinzugefügt!`);
    navigate('rezepte');
}

// Funktion: Rezept aktualisieren (nach dem Bearbeiten speichern)
function rezeptAktualisieren(event, altesName) {
    event.preventDefault();

    const rezeptName = document.getElementById('rezept-name').value;
    const zutatenText = document.getElementById('zutaten').value;
    const anleitung = document.getElementById('anleitung').value;

    const zutaten = zutatenText.split(',').map(item => {
        const [name, menge, einheit] = item.split(':').map(el => el.trim());
        return { name, menge: parseFloat(menge), einheit };
    });

    // Rezept in der Liste aktualisieren
    const rezeptIndex = rezepte.findIndex(r => r.name === altesName);
    if (rezeptIndex >= 0) {
        rezepte[rezeptIndex] = {
            name: rezeptName,
            zutaten,
            anleitung: encodeURIComponent(anleitung) // Zeilenumbrüche sicher speichern
        };
        speichereDaten();
        zeigeBenachrichtigung(`"${altesName}" wurde aktualisiert!`);
        navigate('rezepte');
    }
}

// Funktion: Rezept zur Einkaufsliste hinzufügen
function rezeptZurEinkaufslisteHinzufügen(rezeptName) {
    const rezept = rezepte.find(r => r.name === rezeptName);
    if (rezept) {
        rezept.zutaten.forEach(zutat => {
            if (einkaufsliste[zutat.name]) {
                einkaufsliste[zutat.name].menge += zutat.menge;
            } else {
                einkaufsliste[zutat.name] = { menge: zutat.menge, einheit: zutat.einheit };
            }
        });
        verwendeteRezepte[rezeptName] = (verwendeteRezepte[rezeptName] || 0) + 1;
        speichereDaten();
        zeigeBenachrichtigung(`"${rezeptName}" wurde zur Einkaufsliste hinzugefügt!`);
    }
}

// Funktion: Rezept aus der Einkaufsliste entfernen
function rezeptAusEinkaufslisteEntfernen(rezeptName) {
    const rezept = rezepte.find(r => r.name === rezeptName);
    if (rezept && verwendeteRezepte[rezeptName]) {
        rezept.zutaten.forEach(zutat => {
            if (einkaufsliste[zutat.name]) {
                einkaufsliste[zutat.name].menge -= zutat.menge;
                if (einkaufsliste[zutat.name].menge <= 0) {
                    delete einkaufsliste[zutat.name];
                }
            }
        });
        verwendeteRezepte[rezeptName] -= 1;
        if (verwendeteRezepte[rezeptName] <= 0) {
            delete verwendeteRezepte[rezeptName];
        }
        speichereDaten();
        zeigeBenachrichtigung(`"${rezeptName}" wurde aus der Einkaufsliste entfernt!`);
        navigate('einkaufsliste');
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
function rezeptLöschen(rezeptName) {
    if (!confirm(`Bist du sicher, dass du "${rezeptName}" löschen möchtest?`)) {
        return; // Abbrechen, wenn der Nutzer "Abbrechen" klickt
    }

    const index = rezepte.findIndex(r => r.name === rezeptName);
    if (index >= 0) {
        rezepte.splice(index, 1);
        // Einkaufsliste aktualisieren
        aktualisiereEinkaufslisteNachLoeschen(rezeptName);
        speichereDaten();
        zeigeBenachrichtigung(`"${rezeptName}" wurde gelöscht!`);
        navigate('rezepte');
    }
}

function aktualisiereEinkaufslisteNachLoeschen(rezeptName) {
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
        speichereDaten();
        zeigeBenachrichtigung(`"${rezeptName}" wurde auch aus der Einkaufsliste entfernt!`);
    }
}

function einkaufslisteLeeren() {
    if (!confirm("Bist du sicher, dass du die gesamte Einkaufsliste löschen möchtest?")) {
        return;
    }
    einkaufsliste = {};
    verwendeteRezepte = {};
    speichereDaten();
    zeigeBenachrichtigung("Die Einkaufsliste wurde geleert!");
    navigate('einkaufsliste');
}

function einkaufslisteTeilen() {
    let text = "🛒 Meine Einkaufsliste:\n\n";
    
    Object.entries(einkaufsliste).forEach(([name, details]) => {
        text += `- ${name}: ${details.menge} ${details.einheit}\n`;
    });

    const encodedText = encodeURIComponent(text);
    const whatsappLink = `https://api.whatsapp.com/send?text=${encodedText}`;
    const mailLink = `mailto:?subject=Meine Einkaufsliste&body=${encodedText}`;

    // Einfache Buttons zum Teilen
    const shareOptions = `
        <button onclick="window.open('${whatsappLink}', '_blank')">📱 WhatsApp</button>
        <button onclick="window.open('${mailLink}', '_blank')">📧 E-Mail</button>
    `;
    
    document.getElementById('content').innerHTML += `<div class="share-box">${shareOptions}</div>`;
}

// Beim Laden der Seite die gespeicherten Daten abrufen
ladeDaten();

// Standard-Ansicht beim Start
navigate('rezepte');
