const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sql = require('mssql');
const axios = require('axios');
const bcrypt = require('bcrypt');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const dbConfig = {
  user: 'Well1',
  password: 'well228608',
  server: 'sanghinstance.chasw9cgenor.ap-south-1.rds.amazonaws.com',
  port: 1857,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

const defaultDatabase = 'BankCompany'; // Default database name

connectToDatabase(defaultDatabase)
  .then(() => {
    console.log(`Connected to the default database: ${defaultDatabase}`);
  })
  .catch((error) => {
    console.error('Error connecting to the default database:', error);
  });

app.get('/api/company_code', (req, res) => {
  const query = 'SELECT * FROM BankCompany.dbo.CompanyMaster';
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});

app.get('/api/database_year_master/:compCode', (req, res) => {
  const compCode = req.params.compCode; 
  const query = `SELECT * FROM BankCompany.dbo.YearMaster WHERE CompCode = '${compCode}'`;
  console.log("Query : ",query);
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});


app.post('/api/dblogin', (req, res) => {
  const { clientId, DBpassword } = req.body;
  console.log("parameters ",{ clientId, DBpassword });
  // Assuming you have a SQL database connection named 'sql'

  const query = `SELECT CompCode FROM BankCompany.dbo.CompanyMaster WHERE ClientID = '${clientId}' AND MainPassword = '${DBpassword}'`;
  
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      if (result.recordset.length > 0) {
        const compCode = result.recordset[0].CompCode;
        res.json({ compCode });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    }
  });
});


app.post('/connect', async (req, res) => {
  const { dbcompanyCode } = req.body;
  console.log("Connect data",{ dbcompanyCode });
  if (!dbcompanyCode ) {
    return res.status(400).json({ error: 'Company code required' });
  }

  const databaseName = `BankData${dbcompanyCode}`;
  console.log('BankData${companyCode}', `BankData${dbcompanyCode}`);
  // const databaseName = `GapData${companyCode}`;

  if (sql && sql.close) {
    await sql.close();
    console.log('Closed existing database connection');
  }

  try {
    const isConnected = await connectToDatabase(databaseName);
    if (isConnected) {
      res.json({ message: `Successfully connected to the ${databaseName} database` });
    } else {
      res.status(500).json({ error: 'Failed to connect to the database' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Connect to the database function
async function connectToDatabase(databaseName) {
  const config = {
    ...dbConfig,
    database: databaseName
  };
  try {
    await sql.connect(config);
    console.log("config", config);
    console.log(`Connected to the ${databaseName} database`);
    return true;
  } catch (error) {
    console.error('Error connecting to the database:', error);
    return false;
  }
};

app.put('/api/DB-change-password', async (req, res) => {
  const { clientId, oldDBPassword, newDBPassword } = req.body;

  try {
    // Validate input (optional, depending on your requirements)
    const userQuery = `
        SELECT * FROM BankCompany.dbo.CompanyMaster
        WHERE ClientID = '${clientId}'
      `;

    sql.query(userQuery, async (err, result) => {
      if (err) {
        console.log('Error Executing SQL query:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.recordset.length > 0) {
          const storedPassword = result.recordset[0].MainPassword;

          if (oldDBPassword === storedPassword) {
            
            const updateQuery = `
                UPDATE BankCompany.dbo.CompanyMaster
                SET MainPassword = '${newDBPassword}'
                WHERE ClientID = '${clientId}'
              `;

            sql.query(updateQuery, (updateErr) => {
              if (updateErr) {
                console.log('Error updating password:', updateErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Password changed successfully' });
                console.log("Password Updated !...");

              }
            });
          } else {
            res.status(401).json({ error: 'Incorrect old password' });
          }
        } else {
          res.status(404).json({ error: 'User not found' });
        }
      }
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/close-sql-connection', async (req, res) => {
  try {
    // Close the SQL connection
    await sql.close();
    res.json({ message: 'SQL connection closed successfully' });
  } catch (error) {
    console.error('Error closing SQL connection:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Assuming you have your route defined like this
app.post('/logout', async (req, res) => {
  try {
    await sql.connect(defaultDatabase);
    console.log(`Reconnected to the default database: ${defaultDatabase}`);

    // Respond to the client indicating successful logout
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Error closing SQL connection or reconnecting to the default database:', error);
    // Respond with an error to the client
    res.status(500).json({ error: 'An error occurred during logout' });
  }
});



app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // Validate input (optional, depending on your requirements)
  const query = `
    SELECT * FROM Users
    WHERE UserName = '${username}'
  `;

  sql.query(query, async (err, result) => {
    if (err) {
      console.log('Error Executing SQL query :', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      if (result.recordset.length > 0) {
        const storedHashedPassword = result.recordset[0].Password;

        // Compare entered password with stored hashed password
        const passwordMatch = await bcrypt.compare(password, storedHashedPassword);

        const loggedInUsername = result.recordset[0].UserName;
        if (passwordMatch) {
          res.json({ message: 'Login successful', username: loggedInUsername });
        } else {
          res.status(401).json({ error: 'Invalid credentials' });
        }
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    }
  });
});

// Start the server
const PORT = process.env.PORT || 8090;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.put('/api/change-password', async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;

  try {
    // Validate input (optional, depending on your requirements)
    const userQuery = `
        SELECT * FROM Users
        WHERE UserName = '${username}'
      `;

    sql.query(userQuery, async (err, result) => {
      if (err) {
        console.log('Error Executing SQL query:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.recordset.length > 0) {
          const storedHashedPassword = result.recordset[0].Password;

          // Compare entered old password with stored hashed password
          const passwordMatch = await bcrypt.compare(oldPassword, storedHashedPassword);

          if (passwordMatch) {
            // Hash the new password
            const newHashedPassword = await bcrypt.hash(newPassword, 10);

            // Update the password in the database
            const updateQuery = `
                UPDATE Users
                SET Password = '${newHashedPassword}'
                WHERE UserName = '${username}'
              `;

            sql.query(updateQuery, (updateErr) => {
              if (updateErr) {
                console.log('Error updating password:', updateErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Password changed successfully' });
                console.log("Password Updated !...");

              }
            });
          } else {
            res.status(401).json({ error: 'Incorrect old password' });
          }
        } else {
          res.status(404).json({ error: 'User not found' });
        }
      }
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/Users', async (req, res) => {
  const {
    username,
    password,
    isAdmin,
    allowMasterAdd,
    allowMasterEdit,
    allowMasterDelete,
    allowEntryAdd,
    allowEntryEdit,
    allowEntryDelete,
    allowBackdatedEntry,
    passwordHint,
  } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    //console.log("Hashed Password",hashedPassword);
    const query = `
          INSERT INTO Users (
            UserName,
            Password,
            Passwordhint,
            Administrator,
            AllowMasterAdd,
            AllowMasterEdit,
            AllowMasterDelete,
            AllowEntryAdd,
            AllowEntryEdit,
            AllowEntryDelete,
            AllowBackdatedEntry
          )
          VALUES (
            '${username}',
            '${hashedPassword}',       --Store the hashed password
            '${passwordHint}',
            '${isAdmin ? 1 : 0}',
            '${allowMasterAdd ? 1 : 0}',
            '${allowMasterEdit ? 1 : 0}',
            '${allowMasterDelete ? 1 : 0}',
            '${allowEntryAdd ? 1 : 0}',
            '${allowEntryEdit ? 1 : 0}',
            '${allowEntryDelete ? 1 : 0}',
            '${allowBackdatedEntry ? 1 : 0}'
          )
        `;

    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'User created successfully' });
      }
    });
  } catch (error) {
    console.error('Error hashing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/api/getUsers', (req, res) => {
  const query = `SELECT * FROM Users`;

  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});

/* app.get('/api/getUsers', async (req, res) => {
  try {
    await poolConnect; // ensures the pool has connected
    const request = new sql.Request(pool);
    const result = await request.query('SELECT * FROM Users');
    res.json(result.recordset);
  } catch (err) {
    console.error('SQL error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}); */

// Example endpoint: Update an existing item
app.put('/api/updateUser/:username', async (req, res) => {
  const { username } = req.params;
  const {
    password,
    isAdmin,
    allowMasterAdd,
    allowMasterEdit,
    allowMasterDelete,
    allowEntryAdd,
    allowEntryEdit,
    allowEntryDelete,
    allowBackdatedEntry,
    passwordHint } = req.body;

  try {
    const hashPassword = await bcrypt.hash(password, 10);
    const query = `UPDATE Users SET  Password='${hashPassword}', Administrator=${isAdmin ? 1 : 0}, AllowMasterAdd=${allowMasterAdd ? 1 : 0}, AllowMasterEdit=${allowMasterEdit ? 1 : 0}, AllowMasterDelete=${allowMasterDelete ? 1 : 0}, AllowEntryAdd=${allowEntryAdd ? 1 : 0}, AllowEntryEdit=${allowEntryEdit ? 1 : 0}, AllowEntryDelete=${allowEntryDelete ? 1 : 0}, AllowBackdatedEntry=${allowBackdatedEntry ? 1 : 0},Passwordhint='${passwordHint}' WHERE UserName ='${username}'`;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Item updated successfully' });
      }
    });
  } catch (error) {
    console.log("error for updating hashpassword", error);
    res.status(500).json({ error: 'internal server error' });
  }
});

app.delete('/api/deleteUser/:UserName', (req, res) => {
  const { UserName } = req.params;
  const query = `DELETE FROM Users WHERE UserName = '${UserName}'`;
  sql.query(query, (err) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ message: 'Item deleted successfully' });
    }
  });
});


// For Year Master  ------------------------------------------------------------------------------------

app.get('/api/year_master', (req, res) => {
  const query = 'SELECT * FROM YearMaster';
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});

app.post('/api/year_master', (req, res) => {
  const { YearCode, StartYear, EndYear, FinancialYear, DeptCode, CompCode } = req.body
  const query = `INSERT INTO YearMaster (YearCode, StartYear , EndYear , FinancialYear , DeptCode ,  CompCode ) VALUES ('${YearCode}','${StartYear}','${EndYear}','${FinancialYear}', '${DeptCode}' ,  '${CompCode}')`;
  sql.query(query, (err) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ message: 'Year created successfully' });
    }
  });
});

app.put('/api/year_master/:YearCode', (req, res) => {
  const { YearCode } = req.params;
  const { StartYear, EndYear, FinancialYear, DeptCode, CompCode } = req.body
  const query = `UPDATE YearMaster SET StartYear='${StartYear}', EndYear='${EndYear}', FinancialYear=N'${FinancialYear}', DeptCode=N'${DeptCode}', CompCode=N'${CompCode}' WHERE YearCode='${YearCode}'`;
  sql.query(query, (err) => {
    if (err) {
      console.log('error:', err);
      res.status(500).json({ error: 'internal server error' });
    } else {
      res.json({ message: 'Year created successfully' });
    }
  });
});

app.delete('/api/year_master/:YearCode', async (req, res) => {
  const { YearCode } = req.params;
  const UserName = req.headers['username'];

  try {
    // Fetch user permissions from the database based on the user making the request
    const userPermissionsQuery = `SELECT AllowMasterDelete FROM Users WHERE UserName='${UserName}'`;

    sql.query(userPermissionsQuery, async (userErr, userResults) => {
      if (userErr) {
        console.log('Error fetching user permissions:', userErr);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      // Check if user results are not empty
      if (userResults.recordset && userResults.recordset.length > 0) {
        // Check if user has permission to delete entries
        const { AllowMasterDelete } = userResults.recordset[0];

        if (AllowMasterDelete === 1) {
          // The user has permission to delete entries
          const deleteQuery = `DELETE FROM YearMaster WHERE YearCode=${YearCode}`;

          sql.query(deleteQuery, (deleteErr) => {
            if (deleteErr) {
              console.log('Error deleting entry:', deleteErr);
              res.status(500).json({ error: 'Internal server error' });
            } else {
              res.json({ message: 'Year deleted successfully' });
            }
          });
        } else {
          // User does not have permission to delete entries
          res.status(403).json({ error: 'Permission denied. You do not have the necessary permissions to delete entries.' });
        }
      } else {
        // User not found in the database
        res.status(404).json({ error: 'User not found.' });
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// app.delete('/api/year_master/:YearCode', (req,res)=>{
//   const { YearCode } = req.params;
//   //console.log("Comp Code  ",CompCode);
//   const query = `DELETE FROM YearMaster WHERE YearCode=${YearCode}`;
//   sql.query(query,(err) => {
//       if (err) {
//         console.log('Error:', err);
//         res.status(500).json({ error: 'Internal server error' });
//       } else {
//         res.json({ message: 'Year deleted successfully' });
//       }
//     });
// });


//For BANK PARTY MASTER

app.get('/api/party', (req, res) => {
  const query = 'SELECT * FROM PartyMaster';
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});

app.post('/api/party', (req, res) => {
  const { PARTYCODE, PARTYNAME, ACCOUNTNO, IFSCCODE, BANKNAME, BRANCH } = req.body;
  const query = `INSERT INTO PARTYMASTER (PARTYCODE, PARTYNAME, ACCOUNTNO, IFSCCODE, BANKNAME, BRANCH) VALUES (${PARTYCODE}, '${PARTYNAME}', '${ACCOUNTNO}', '${IFSCCODE}', '${BANKNAME}', '${BRANCH}')`;
  sql.query(query, (err) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ message: 'Party created successfully' });
    }
  });
});

app.put('/api/party/:PartyCode', (req, res) => {
  const { PartyCode } = req.params;
  const { PARTYNAME, ACCOUNTNO, IFSCCODE, BANKNAME, BRANCH } = req.body;
  const query = `
    UPDATE PARTYMASTER
    SET PARTYNAME=N'${PARTYNAME}', ACCOUNTNO='${ACCOUNTNO}', IFSCCODE='${IFSCCODE}', BANKNAME=N'${BANKNAME}', BRANCH=N'${BRANCH}'
    WHERE PARTYCODE='${PartyCode}';
  `;
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      if (result.rowsAffected && result.rowsAffected[0] > 0) {
        res.json({
          message: 'Party updated successfully',
          PartyCode,
          PARTYNAME,
          ACCOUNTNO,
          IFSCCODE,
          BANKNAME,
          BRANCH
        });
      } else {
        res.status(404).json({ error: 'Record not found' });
      }
    }
  });
});

/* app.delete('/api/party/:PartyCode', (req,res)=>{
  const { PartyCode } = req.params;
  const query = `DELETE FROM PartyMaster WHERE PartyCode='${PartyCode}'`;
  sql.query(query,(err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'PArty deleted successfully' });
      }
    });
}); */

app.delete('/api/party/:PartyCode', async (req, res) => {
  const { PartyCode } = req.params;
  const UserName = req.headers['username'];

  try {
    // Fetch user permissions from the database based on the user making the request
    const userPermissionsQuery = `SELECT AllowMasterDelete FROM Users WHERE UserName='${UserName}'`;

    sql.query(userPermissionsQuery, async (userErr, userResults) => {
      if (userErr) {
        console.log('Error fetching user permissions:', userErr);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      // Check if user results are not empty
      if (userResults.recordset && userResults.recordset.length > 0) {
        // Check if user has permission to delete entries
        const { AllowMasterDelete } = userResults.recordset[0];

        if (AllowMasterDelete === 1) {
          // The user has permission to delete entries
          const deleteQuery = `DELETE FROM PartyMaster WHERE PartyCode='${PartyCode}'`;

          sql.query(deleteQuery, (deleteErr) => {
            if (deleteErr) {
              console.log('Error deleting entry:', deleteErr);
              res.status(500).json({ error: 'Internal server error' });
            } else {
              res.json({ message: 'Year deleted successfully' });
            }
          });
        } else {
          // User does not have permission to delete entries
          res.status(403).json({ error: 'Permission denied. You do not have the necessary permissions to delete entries.' });
        }
      } else {
        // User not found in the database
        res.status(404).json({ error: 'User not found.' });
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// For BankMaster  ------------------------------------------------------------------------------------

app.get('/api/bank', (req, res) => {
  const query = 'SELECT * FROM BankMaster';
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});

app.post('/api/bank', (req, res) => {
  const { BANKCODE, BANKNAME, BRANCH, IFSCCODE, ACCOUNTNO, ACCOUNTTYPE, REMARK1 } = req.body;
  const query = `
    INSERT INTO BANKMASTER (BANKCODE, BANKNAME, BRANCH, IFSCCODE, ACCOUNTNO, ACCOUNTTYPE, REMARK1)
    VALUES ('${BANKCODE}', N'${BANKNAME}', N'${BRANCH}', '${IFSCCODE}', '${ACCOUNTNO}', '${ACCOUNTTYPE}', N'${REMARK1}');
  `;
  sql.query(query, (err) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ message: 'Bank created successfully' });
    }
  });
});

app.put('/api/bank/:BankCode', (req, res) => {
  const { BankCode } = req.params;
  const { BANKNAME, BRANCH, IFSCCODE, ACCOUNTNO, ACCOUNTTYPE, REMARK1 } = req.body;
  const query = `
    UPDATE BANKMASTER
    SET BANKNAME=N'${BANKNAME}', BRANCH=N'${BRANCH}', IFSCCODE='${IFSCCODE}', ACCOUNTNO='${ACCOUNTNO}', ACCOUNTTYPE='${ACCOUNTTYPE}', REMARK1=N'${REMARK1}'
    WHERE BANKCODE='${BankCode}';
  `;
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      if (result.rowsAffected && result.rowsAffected[0] > 0) {
        res.json({
          message: 'Bank updated successfully',
          BankCode,
          BANKNAME,
          BRANCH,
          IFSCCODE,
          ACCOUNTNO,
          ACCOUNTTYPE,
          REMARK1
        });
      } else {
        res.status(404).json({ error: 'Record not found' });
      }
    }
  });
});

/* app.delete('/api/bank/:BankCode', (req,res)=>{
  const { PartyCode } = req.params;
  const query = `DELETE FROM BankMaster WHERE BankCode=${BankCode}`;
  sql.query(query,(err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Bank deleted successfully' });
      }
    });
}); */


app.delete('/api/bank/:BankCode', async (req, res) => {
  const { BankCode } = req.params;
  const UserName = req.headers['username'];

  try {
    // Fetch user permissions from the database based on the user making the request
    const userPermissionsQuery = `SELECT AllowMasterDelete FROM Users WHERE UserName='${UserName}'`;

    sql.query(userPermissionsQuery, async (userErr, userResults) => {
      if (userErr) {
        console.log('Error fetching user permissions:', userErr);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      // Check if user results are not empty
      if (userResults.recordset && userResults.recordset.length > 0) {
        // Check if user has permission to delete entries
        const { AllowMasterDelete } = userResults.recordset[0];

        if (AllowMasterDelete === 1) {
          // The user has permission to delete entries
          const deleteQuery = `DELETE FROM BankMaster WHERE BankCode='${BankCode}'`;

          sql.query(deleteQuery, (deleteErr) => {
            if (deleteErr) {
              console.log('Error deleting entry:', deleteErr);
              res.status(500).json({ error: 'Internal server error' });
            } else {
              res.json({ message: 'Year deleted successfully' });
            }
          });
        } else {
          // User does not have permission to delete entries
          res.status(403).json({ error: 'Permission denied. You do not have the necessary permissions to delete entries.' });
        }
      } else {
        // User not found in the database
        res.status(404).json({ error: 'User not found.' });
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//For Bank ENtry

app.get('/api/bankentries', (req, res) => {
  const query = 'SELECT * FROM BANKENTRIES';
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});

app.post('/api/bankentries', (req, res) => {
  const { ENTRYNO, TRDATE, BANKCODE, PARTYCODE, AMOUNT, CHQNO, REMARK1 } = req.body;
  const query = `INSERT INTO BANKENTRIES (ENTRYNO, TRDATE, BANKCODE, PARTYCODE, AMOUNT, CHEQUENO, REMARK1) VALUES (${ENTRYNO}, '${TRDATE}', '${BANKCODE}', '${PARTYCODE}', ${AMOUNT}, '${CHQNO}', '${REMARK1}')`;
  sql.query(query, (err) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ message: 'Bank entry created successfully' });
    }
  });
});

app.put('/api/bankentries/:EntryNo', (req, res) => {
  const EntryNo = req.params.EntryNo;
  const { TRDATE, BANKCODE, PARTYCODE, AMOUNT, CHQNO, REMARK1 } = req.body;
  const query = `UPDATE BANKENTRIES SET 
                 TRDATE = '${TRDATE}', 
                 BANKCODE = '${BANKCODE}', 
                 PARTYCODE = '${PARTYCODE}', 
                 AMOUNT = ${AMOUNT}, 
                 CHEQUENO = '${CHQNO}', 
                 REMARK1 = '${REMARK1}' 
                 WHERE ENTRYNO = ${EntryNo}`;
  sql.query(query, (err) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ message: 'Bank entry updated successfully' });
    }
  });
});

app.delete('/api/bankentries/:EntryNo', (req, res) => {
  const EntryNo = req.params.EntryNo;
  const query = `DELETE FROM BANKENTRIES WHERE ENTRYNO = ${EntryNo}`;
  sql.query(query, (err) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ message: 'Bank entry deleted successfully' });
    }
  });
});


