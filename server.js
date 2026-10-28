
const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Estado global de los asientos
const seats = {};
const precios = { A: 6, B: 5, C: 4 };

// Crear los 30 asientos
['A', 'B', 'C'].forEach(row => {
    for (let i = 1; i <= 10; i++) {
        seats[`${row}${i}`] = {
            status: 'available',
            user: '',
            ownerId: null,
            expireAt: 0,
            price: precios[row]
        };
    }
});

// Actualizar el panel de administrador
function updateAdmin() {
    io.emit('adminState', seats);
}

// Liberar un asiento
function liberarAsiento(seatId) {
    const seat = seats[seatId];

    if (!seat) return;

    seats[seatId] = {
        status: 'available',
        user: '',
        ownerId: null,
        expireAt: 0,
        price: seat.price
    };

    io.emit('release', seatId);

    // Actualizar administrador
    updateAdmin();
}

// Conexiones WebSocket
io.on('connection', (socket) => {

    console.log('Usuario conectado:', socket.id);

    // Enviar estado inicial
    socket.emit('init', seats);

    // Enviar estado inicial al administrador
    socket.emit('adminState', seats);

    // Registrar usuario
    socket.on('register', (username) => {
        if (typeof username === 'string') {
            socket.username = username.trim().slice(0, 50);
        }
    });

    // Reservar asiento
    socket.on('reserve', (seatId) => {

        const seat = seats[seatId];

        if (!seat || !socket.username ||
            seat.status !== 'available') {

            socket.emit('reservationError', {
                seatId,
                message: 'Asiento no disponible'
            });

            return;
        }

        seat.status = 'reserved';
        seat.user = socket.username;
        seat.ownerId = socket.id;
        seat.expireAt = Date.now() + 60000;

        const expireAt = seat.expireAt;

        // Notificar a todos los clientes
        io.emit('reserve', {
            seatId,
            user: seat.user,
            ownerId: socket.id,
            expireAt
        });

        // Actualizar administrador en tiempo real
        updateAdmin();

        // Liberación automática después de 60 segundos
        setTimeout(() => {

            const actual = seats[seatId];

            if (actual.status === 'reserved' &&
                actual.expireAt === expireAt &&
                Date.now() >= expireAt) {

                liberarAsiento(seatId);
            }

        }, 60000);
    });

    // Liberar un asiento manualmente
    socket.on('release', (seatId) => {

        const seat = seats[seatId];

        if (seat &&
            seat.status === 'reserved' &&
            seat.ownerId === socket.id) {

            liberarAsiento(seatId);
        }
    });

    // Confirmar compra
    socket.on('buy', (seatIds) => {

        if (!Array.isArray(seatIds) || !socket.username) {
            return;
        }

        const ids = [...new Set(seatIds)];

        // Validar que los asientos pertenezcan al usuario
        const validos = ids.length > 0 && ids.every(id => {

            const seat = seats[id];

            return seat &&
                seat.status === 'reserved' &&
                seat.ownerId === socket.id &&
                seat.expireAt > Date.now();
        });

        if (!validos) {

            socket.emit(
                'purchaseError',
                'No se pudo confirmar la compra'
            );

            return;
        }

        // Marcar asientos como vendidos
        ids.forEach(seatId => {

            const seat = seats[seatId];

            seat.status = 'sold';
            seat.expireAt = 0;
            seat.ownerId = null;

            io.emit('buy', {
                seatId,
                user: seat.user
            });
        });

        // Actualizar administrador después de comprar
        updateAdmin();

        console.log(
            `${socket.username} compró: ${ids.join(', ')}`
        );
    });

    // ADMINISTRADOR: Liberar todas las reservas
    socket.on('adminReleaseAll', () => {

        Object.keys(seats).forEach(seatId => {

            if (seats[seatId].status === 'reserved') {
                liberarAsiento(seatId);
            }

        });

        updateAdmin();

        console.log('Administrador liberó las reservas');
    });

    // ADMINISTRADOR: Resetear todos los asientos
    socket.on('adminReset', () => {

        Object.keys(seats).forEach(seatId => {

            const price = seats[seatId].price;

            seats[seatId] = {
                status: 'available',
                user: '',
                ownerId: null,
                expireAt: 0,
                price: price
            };
        });

        // Notificar a todos los clientes
        io.emit('resetSeats', seats);

        // Actualizar administrador
        updateAdmin();

        console.log('Administrador reseteó los asientos');
    });

    // Desconexión de clientes
    socket.on('disconnect', () => {

        Object.keys(seats).forEach(seatId => {

            const seat = seats[seatId];

            if (seat.status === 'reserved' &&
                seat.ownerId === socket.id) {

                liberarAsiento(seatId);
            }
        });

        console.log('Usuario desconectado:', socket.id);
    });
});

// Iniciar servidor
const PORT = 4000;

server.listen(PORT, () => {
    console.log(`Servidor activo en http://localhost:${PORT}`);
});
