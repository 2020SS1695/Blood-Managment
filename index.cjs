const express = require('express');
const { fileURLToPath } = require('url');
const { dirname } = require('path');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

var path = require('path');

const app = express();
const port = 3000;
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));

app.set('view engine', 'ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'blood',
    password: '12345',
    port: 5432
})

pool.connect()
    // Route to handle form submission
app.post("/submit", async(req, res) => {
    try {
        const { username, address, phone, email, registration_date, age, weight, blood_group, health, blood_volume } = req.body;

        // Insert the registration data into the 'donor' table
        const query = `
            INSERT INTO donor (username, address, phone, email, registration_date, age, weight, blood_group, health, blood_volume)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;
        await pool.query(query, [username, address, phone, email, registration_date, age, weight, blood_group, health, blood_volume]);

        // Redirect to the confirmation page after successful insertion
        res.redirect("/confirmation");
    } catch (error) {
        console.error("Error inserting data into database:", error);
        res.status(500).send("An error occurred while processing your request.");
    }
});


const hardcodedUserId = 123;
const hardcodedPassword = 'p123';

app.post('/login', async(req, res) => {
    const { userid, password } = req.body;

    try {
        if (userid == hardcodedUserId) {
            // Compare password directly (no hashing for demonstration purpose)
            if (password === hardcodedPassword) {
                res.redirect('/admin'); // Render admin.ejs if passwords match
            } else {
                res.redirect('/login?error=invalid'); // Redirect with error query parameter
            }
        } else {
            res.redirect('/login?error=invalid'); // Redirect with error query parameter
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

app.get("/admin", (req, res) => {
    // res.render('Admin page/admin.ejs', {
    //     rows: undefined
    // });
    pool.connect((err, pool, release) => {
        if (err) {
            console.error('Error acquiring client', err.stack);
            return;
        }
        pool.query('SELECT * FROM donor', (err, result) => {

            result.rows = result.rows.map(row => {
                const date = new Date(row.registration_date);

                // Extract the day, month, and year
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
                const year = date.getFullYear();

                // Format the date as dd-mm-yyyy
                row.registration_date = `${day}-${month}-${year}`;

                return row;
            });

            res.render('Admin page/admin.ejs', {
                rows: result.rows
            })
            release(); // Release the client back to the pool
            // pool.end(); // End the pool (optional)
        });
    });
});




app.get("/login", (req, res) => {
    res.render("auth/login.ejs");
});

app.get("/", (req, res) => {
    res.render("Home/home.ejs");
});

app.get("/services", (req, res) => {
    res.render("Home/services.ejs");
});

app.get("/privacy", (req, res) => {
    res.render("Home/privacy.ejs");
});

app.get("/contact", (req, res) => {
    res.render("Home/contact.ejs");
});


app.get("/register", (req, res) => {
    res.render("auth/register.ejs");
});

app.get("/confirmation", (req, res) => {
    res.render("confirmation.ejs");
});


app.get('/create-donation', (req, res) => {
    res.render('Admin page/create-donation.ejs');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});