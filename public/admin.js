
// Panel de administrador - WebSockets
const socket = io();

// Elementos HTML
const seating = document.getElementById('seating');
const availableCount = document.getElementById('availableCount');
const reservedCount = document.getElementById('reservedCount');
const soldCount = document.getElementById('soldCount');

const releaseAllBtn = document.getElementById('releaseAllBtn');
const resetAllBtn = document.getElementById('resetAllBtn');

// Crear los 30 asientos
function createSeats() {
    ['A', 'B', 'C'].forEach(row => {
        for (let i = 1; i <= 10; i++) {
            const seatId = row + i;

            const div = document.createElement('div');
            div.className = 'seat';
            div.id = seatId;
            div.innerText = seatId;

            seating.appendChild(div);
        }
    });
}

createSeats();

// Actualizar el estado global del cine
function updateAdmin(seats) {
    let available = 0;
    let reserved = 0;
    let sold = 0;

    Object.entries(seats).forEach(([id, info]) => {
        const seat = document.getElementById(id);
        if (!seat) return;

        seat.className = 'seat';

        if (info.status === 'available') {
            available++;
            seat.title = `Disponible - $${info.price}`;
        }

        if (info.status === 'reserved') {
            reserved++;
            seat.classList.add('reserved');
            seat.title = `Reservado por: ${info.user}`;
        }

        if (info.status === 'sold') {
            sold++;
            seat.classList.add('sold');
            seat.title = `Comprado por: ${info.user}`;
        }
    });

    // Actualizar contadores
    availableCount.innerText = available;
    reservedCount.innerText = reserved;
    soldCount.innerText = sold;
}

// Recibir cambios desde el servidor
socket.on('adminState', (seats) => {
    updateAdmin(seats);
});

// Liberar todas las reservas
releaseAllBtn.addEventListener('click', () => {
    const confirmar = confirm(
        '¿Deseas liberar todas las reservas?'
    );

    if (confirmar) {
        socket.emit('adminReleaseAll');
    }
});

// Resetear todos los asientos
resetAllBtn.addEventListener('click', () => {
    const confirmar = confirm(
        '¿Deseas resetear todos los asientos?'
    );

    if (confirmar) {
        socket.emit('adminReset');
    }
});
