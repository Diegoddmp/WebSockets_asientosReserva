//Cliente JavaScript para reservar tickets con webSockets
//conectar con el servidor de sockets
const socket = io();

//obtener los elementos con los que voy a trabajar
const usernameInput = document.getElementById('usernameInput');
const buyBtn = document.getElementById('buyBtn');
const seating = document.getElementById('seating');
const timerDisplay = document.getElementById('timerDisplay');
const selectedList = document.getElementById('selectedList'); // Lista de factura
const totalPriceEl = document.getElementById('totalPrice');   // Total de factura

const selectedSeats = new Set(); // Conjunto para almacenar los asientos seleccionados
let timerInterval = null; // Variable para almacenar el intervalo del temporizador
let reservationEndTime = 0; // Variable para almacenar el tiempo de finalización de la reserva

//crear los asientos de forma dinamica 
function createSeats() {
    ['A', 'B', 'C'].forEach(row => {
        for (let i = 1; i <= 10; i++) {
            const seatId = row + i;
            const div = document.createElement('div');// se hace para crear un div por cada asiento
            div.className = 'seat';
            div.id = seatId;
            div.innerText = seatId;
            //evento al hacer click osbre el asienot 
            div.addEventListener('click', () => {
                const username = usernameInput.value.trim();

                if (!username) {
                    alert("Por favor ingrese su nombre")
                    return;
                }

                socket.emit('register', username);

                if (div.classList.contains('sold')) {
                    return; // Si el asiento ya está vendido, no hacer nada
                }
                //Deseleccionar si ya estaba seleccionado 
                if (selectedSeats.has(seatId)) {
                    selectedSeats.delete(seatId);
                    div.classList.remove('reserved');
                    //envia hacia el servidor un objeto con el id del asiento que se va a liberar
                    socket.emit('release', seatId);
                } else if (!div.classList.contains('reserved') &&
                    !div.classList.contains('reserved-other')) {
                    //seleccionar el asiento y agregarlo al conjunto de asientos seleccionados
                    selectedSeats.add(seatId);
                    div.classList.add('reserved');
                    socket.emit('reserve', seatId);
                }
                updateInvoice(); // Actualizar la mini factura cada vez que se selecciona o deselecciona un asiento 
            });
            seating.appendChild(div);
        }
    });
}

createSeats();

/// Actualizar la mini factura y el precio total
function updateInvoice() {
    selectedList.innerHTML = '';
    let total = 0;

    selectedSeats.forEach(seatId => {
        const price = localSeatsData[seatId]?.price || 0;
        total += price;

        const li = document.createElement('li');
        li.innerText = `Asiento ${seatId} - $${price.toFixed(2)}`;

        selectedList.appendChild(li);
    });

    totalPriceEl.innerText = total.toFixed(2);
}
//Enviar cinfirmacion de compra al servidor cuando se hace click en el boton de comprar


buyBtn.addEventListener('click', () => {

    const username = usernameInput.value.trim();

    if (!username) {
        alert('Por favor ingrese su nombre');
        return;
    }

    if (selectedSeats.size === 0) {
        alert('Primero debe seleccionar un asiento');
        return;
    }

    let factura = 'DETALLE DE COMPRA\n\n';
    factura += 'Cliente: ' + username + '\n\n';

    let total = 0;

    selectedSeats.forEach(seatId => {

        const price = localSeatsData[seatId].price;

        factura += 'Asiento ' + seatId +
                   ' - $' + price.toFixed(2) + '\n';

        total += price;
    });

    factura += '\n------------------------\n';
    factura += 'TOTAL: $' + total.toFixed(2);
    factura += '\n\n¿Desea confirmar la compra?';

    // Mostrar factura antes de comprar
    const confirmar = confirm(factura);

    if (confirmar) {
        socket.emit('buy', Array.from(selectedSeats));
    }
});



// recibir estado inicial de los asientos desde el servidor
socket.on('init', (serverSeats) => {
    localSeatsData = serverSeats;

    Object.entries(serverSeats).forEach(([id, info]) => {
        const seat = document.getElementById(id);
        if (!seat) return;

        seat.classList.remove(
            'reserved',
            'reserved-other',
            'sold'
        );

        seat.title = `Precio: $${info.price}`;

        if (info.status === 'reserved') {

            if (info.ownerId === socket.id) {
                seat.classList.add('reserved');
            } else {
                seat.classList.add('reserved-other');
            }

            seat.title = `Reservado por: ${info.user}`;
        }

        if (info.status === 'sold') {
            seat.classList.add('sold');
            seat.title = `Comprado por: ${info.user}`;
        }
    });
});

//cuando un asiento es reservado por otro cliente
socket.on('reserve', ({ seatId, user, ownerId, expireAt }) => {
    const seat = document.getElementById(seatId);
    if (!seat) return;

    seat.classList.remove('reserved', 'reserved-other');

    if (ownerId === socket.id) {
        // Reserva propia: amarillo
        seat.classList.add('reserved');

        reservationEndTime = expireAt;
        starTimer();
    } else {
        // Reserva ajena: rojo
        seat.classList.add('reserved-other');

        selectedSeats.delete(seatId);
        updateInvoice();
    }

    seat.title = `Reservado por: ${user}`;
});
//cuando un asiento es liberado por otro client
socket.on('release', (seatId) => {
    const seat = document.getElementById(seatId);
    seat.classList.remove('reserved', 'reserved-other');
    seat.title = `Precio: $${localSeatsData[seatId].price}`; // Restaurar tooltip

    // Si mi reserva expiró automáticamente, limpiar mi selección
    if (selectedSeats.has(seatId)) {
        selectedSeats.delete(seatId);
        updateInvoice();
    }

    if (selectedSeats.size === 0) {
        stopTimer();
    }
});

//cuando un asiento es comprado 
socket.on('buy', (data) => {
    const seat = document.getElementById(data.seatId);
    if (!seat) return;
       seat.classList.remove('reserved-other', 'reserved');
    seat.classList.add('sold');
    seat.title = `Ocupado por: ${data.user}`; // Tooltip actualizado

    selectedSeats.delete(data.seatId);
    updateInvoice();

      if (selectedSeats.size === 0) {
        stopTimer();
    }

});

function starTimer() {
    stopTimer(); // Asegurarse de detener cualquier temporizador existente
    timerInterval = setInterval(() => {
        const diff = Math.max(0, Math.floor((reservationEndTime - Date.now()) / 1000));
        timerDisplay.innerText = 'Tiempo restante: ' + diff + ' s';
        if (diff <= 0) {
            stopTimer();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerDisplay.innerText = '';
    }
}

socket.on('purchaseError', (message) => {
    alert(message);
    console.log('Error de compra:', message);
});