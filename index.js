  const express = require('express');
  const bodyParser = require('body-parser');
  const cors = require('cors');
  const sql = require('mssql');
  const axios = require('axios');
  const bcrypt = require('bcrypt');
  const path = require('path');
  const multer = require('multer');
  const AWS = require('aws-sdk');
  const { v4: uuidv4 } = require('uuid');
  const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');


  const app = express();
  app.use(bodyParser.json());
  app.use(cors());

// Database configuration
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

const defaultDatabase = 'WinGapCompany'; // Default database name

// Connect to the default database on server startup
connectToDatabase(defaultDatabase)
  .then(() => {
    console.log(`Connected to the default database: ${defaultDatabase}`);
  })
  .catch((error) => {
    console.error('Error connecting to the default database:', error);
  });

  app.get('/api/company_code', (req, res) => {
    const query = 'SELECT * FROM WinGapCompany.dbo.CompanyMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  app.get('/api/database_year_master', (req, res) => {
    const query = 'SELECT * FROM WinGapCompany.dbo.YearMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });


  app.post('/connect', async (req, res) => {
    const { companyCode, financialYear } = req.body;
  
    if (!companyCode || !financialYear) {
      return res.status(400).json({ error: 'Company code and financial year are required' });
    }
  
    const databaseName = `WinGapData${companyCode}FY${financialYear}`;
    console.log('WinGapData${companyCode}-${financialYear}',`GapData${companyCode}FY${financialYear}`);
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
}


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


app.get('/file/:filename', (req, res) => {
  const params = {
      Bucket: 'webgap-images',
      Key: req.params.filename // Use the filename specified in the URL
  };

  s3.getObject(params, (err, data) => {
      if (err) {
          console.error(err);
          return res.status(500).send('Error retrieving file from S3.');
      }

      // Retrieve original filename from metadata
      const originalFilename = data.Metadata.originalFilename;

      // Set the appropriate Content-Type header
      res.set('Content-Type', data.ContentType);

      // Set the appropriate Content-Disposition header to make the browser display the file
      res.set('Content-Disposition', `inline; filename="${originalFilename}"`);

      // Send the file data in the response
      res.send(data.Body);
  });
});

app.delete('/deletefile/:filename', (req, res) => {
  const params = {
      Bucket: 'webgap-images',
      Key: "56679fb0-b901-4c22-a6cb-8ca6dea65873-efgh.jpg" // Use the filename specified in the URL
  };

  s3.deleteObject(params, (err, data) => {
      if (err) {
          console.error('Error deleting file:', err);
          return res.status(500).send('Error deleting file from S3.');
      }

      console.log('File deleted successfully:', req.params.filename);
      res.send('File deleted successfully.');
  });
});

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: "AKIAZVZ4WKJWCRNGWV56",
  secretAccessKey: "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",
});

// correct code
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // Limit file size to 5MB
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

const checkDeleteAuthority = (req, res, next) => {
  console.log('Checking delete authority middleware');
  const username = req.session.username;
  console.log('Username:', username);
  const query = `SELECT AllowMasterDelete FROM Users WHERE UserName='${username}'`; 
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      if (result && result.recordset && result.recordset.length > 0) { 
        const allowDelete = result.recordset[0].AllowMasterDelete;
        if (allowDelete === 1) { 
          console.log("allowDelete", allowDelete);
          console.log('SQL Query:', query);
          next(); 
        } else {
          res.status(403).json({ error: 'Not allowed to delete' });
        }
      } else {
        res.status(403).json({ error: 'User not found or permission not set' });
      }
    }
  });
};

app.post('/multiple-upload', upload.array('images', 9), (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
      return res.status(400).send('No files uploaded.');
  }

  // Loop through each file and upload it to S3
  files.forEach(file => {
    const params = {
      Bucket: 'webgap-images',
      Key: `${file.originalname}`, // Unique key for the file
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalFilename: file.originalname // Include original filename as metadata
      }
    };

    s3.upload(params, (err, data) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error uploading files to S3.');
      }
      console.log('File uploaded successfully:', data.Location);
    });
  });

  res.send('Files uploaded successfully.');
});


app.post('/single-upload', upload.single('image'), (req, res) => {
  const file = req.file;
  if (!file) {
      return res.status(400).send('No file uploaded.');
  }

  const params = {
      Bucket: 'webgap-images',
      Key: `${file.originalname}`, // Unique key for the file
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalFilename: file.originalname // Include original filename as metadata
    }
  };

  s3.upload(params, (err, data) => {
      if (err) {
          console.error(err);
          return res.status(500).send('Error uploading file to S3.');
      }
      res.send('File uploaded successfully.');
  });
});


app.get('/file/:fileName', (req, res) => {
  const fileName = req.params.fileName;

  // Check if the mapping for the file name exists
  if (!fileMappings[fileName]) {
    return res.status(404).send('File not found.');
  }

  // Retrieve file from S3 using the UUID-prefixed key
  const params = {
    Bucket: 'webgap-images',
    Key: fileMappings[fileName]
  };

  s3.getObject(params, (err, data) => {
    if (err) {
      console.error("Error getting object: ", err);
      return res.status(500).send('Error getting file from S3.');
    }

    // Set response headers based on file metadata
    res.set('Content-Type', data.ContentType);
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);

    // Send the file data as response
    res.send(data.Body);
  });
});

app.delete('/deletefile/:filename', (req, res) => {
  const params = {
      Bucket: 'webgap-images',
      Key: "56679fb0-b901-4c22-a6cb-8ca6dea65873-efgh.jpg" // Use the filename specified in the URL
  };

  s3.deleteObject(params, (err, data) => {
      if (err) {
          console.error('Error deleting file:', err);
          return res.status(500).send('Error deleting file from S3.');
      }

      console.log('File deleted successfully:', req.params.filename);
      res.send('File deleted successfully.');
  });
});




  // Start the server
  const PORT = process.env.PORT || 8090;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  ///im upload

//  const storage = multer.diskStorage({
//    destination: (req, file, cb) => {
//       const destinationPath = path.join('C:/Users/91942/Pictures/photopath');
//       cb(null, destinationPath);
//    },
//    filename: (req, file, cb) => {
//       cb(null, file.originalname);
//    },
// });

// const upload = multer({ storage : storage });


// Serve static files from the photopath directory

app.use('/img', express.static('C:/Users/91942/Pictures/photopath'));

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

    app.post('/api/users', async (req, res) => {
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


    app.get('/api/getusers', (req, res) => {
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

      try{
        const hashPassword = await bcrypt.hash(password ,10);
        const query = `UPDATE Users SET  Password='${hashPassword}', Administrator=${isAdmin ? 1 : 0}, AllowMasterAdd=${allowMasterAdd ? 1 : 0}, AllowMasterEdit=${allowMasterEdit ? 1 : 0}, AllowMasterDelete=${allowMasterDelete ? 1 : 0}, AllowEntryAdd=${allowEntryAdd ? 1 : 0}, AllowEntryEdit=${allowEntryEdit ? 1 : 0}, AllowEntryDelete=${allowEntryDelete ? 1 : 0}, AllowBackdatedEntry=${allowBackdatedEntry ? 1 : 0},Passwordhint='${passwordHint}' WHERE UserName ='${username}'`;
        sql.query(query, (err) => {
          if (err) {
            console.log('Error:', err);
            res.status(500).json({ error: 'Internal server error' });
          } else {
            res.json({ message: 'Item updated successfully' });
          }
        });
      }catch(error){
          console.log("error for updating hashpassword", error);
          res.status(500).json({error:'internal server error'});
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

  // For AcGroupMaster
  // GET all AcGroupMaster entries
  app.get('/api/acgroups', (req, res) => {
    const query = 'SELECT * FROM AcGroupMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // POST a new AcGroupMaster entry
  app.post('/api/acgroups', (req, res) => {
    const {
      AcGroupCode,
      AcGroupName,
      AcGroupNameEng,
      AcGroupType,
      AcGroupPrintPosition,
      DeptCode,
      YearCode,
      UserID,
    } = req.body;
    
    const query = `
      INSERT INTO AcGroupMaster (AcGroupCode, AcGroupName, AcGroupNameEng, AcGroupType, AcGroupPrintPosition, DeptCode, YearCode, UserID)
      VALUES (N'${AcGroupCode}', N'${AcGroupName}', N'${AcGroupNameEng}', N'${AcGroupType}', N'${AcGroupPrintPosition}', '${DeptCode}', '${YearCode}', '${UserID}');
    `;
    
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'AcGroupMaster entry created successfully' });
      }
    });
  });


  app.put('/api/acgroups/:AcGroupCode', (req, res) => {
    const { AcGroupCode } = req.params;
    const {
      AcGroupName,
      AcGroupNameEng,
      AcGroupType,
      AcGroupPrintPosition,
      DeptCode,
      YearCode,
      UserID,
    } = req.body;

    const query = `
      UPDATE AcGroupMaster
      SET AcGroupName=N'${AcGroupName}',
          AcGroupNameEng=N'${AcGroupNameEng}',
          AcGroupType=N'${AcGroupType}',
          AcGroupPrintPosition=N'${AcGroupPrintPosition}',
          DeptCode=N'${DeptCode}',
          YearCode=N'${YearCode}',
          UserID=N'${UserID}'
      WHERE AcGroupCode='${AcGroupCode}';
    `;

    sql.query(query, (err) => {
      if (err) {
        console.log('Error updating AcGroupMaster entry:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        console.log('AcGroupMaster entry updated successfully');
        res.json({ message: 'AcGroupMaster entry updated successfully' });
      }
    });
  });

  // DELETE an AcGroupMaster entry
  app.delete('/api/acgroups/:acGroupCode', async (req, res) => {
    const { acGroupCode } = req.params;
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
            const deleteQuery = `DELETE FROM AcGroupMaster WHERE AcGroupCode='${acGroupCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'AcGroupMaster deleted successfully' });
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
  

  // For DeptMaster ---------------

  app.get('/api/items' ,(req,res)=>{
      const query = 'SELECT * FROM DeptMaster'
      sql.query(query, (err , result)=>{
          if(err){
              console.log('error:', err);
              res.status(500).json({error:'internal server error'});
          }else{
              res.json(result.recordset);
          }
      })
  })

  app.post('/api/items' , (req,res)=>{
      const {DeptCode, DeptName , DeptNameENG , CompCode , Flag, UserID} = req.body
      const query = `INSERT INTO DeptMaster (DeptCode ,DeptName, DeptNameENG, CompCode, Flag, UserID) VALUES ('${DeptCode}',N'${DeptName}',N'${DeptNameENG}','${CompCode}',N'${Flag}',${UserID})`;
      sql.query(query, (err) => {
          if (err) {
            console.log('Error:', err);
            res.status(500).json({ error: 'Internal server error' });
          } else {
            res.json({ message: 'Item created successfully' });
          }
        });
  });

  app.put('/api/item/:deptCode', (req,res)=>{
      const {deptCode} = req.params;
      const { DeptName , DeptNameENG , CompCode , Flag , UserID} = req.body
      const query = `UPDATE DeptMaster SET DeptName=N'${DeptName}',DeptNameENG=N'${DeptNameENG}',CompCode='${CompCode}',Flag=N'${Flag}' ,UserID=${UserID} WHERE DeptCode=${deptCode}`;
      sql.query(query , (err)=>{
          if(err){
              console.log('error:',err);
              res.status(500).json({error:'internal server error'});
          }else{
              res.json({ message: 'Item created successfully' });
          }
      });
  });

  app.delete('/api/items/:deptCode', async (req, res) => {
    const { deptCode } = req.params;
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
            const deleteQuery = `DELETE FROM DeptMaster WHERE DeptCode='${deptCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'DeptMaster deleted successfully' });
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
  

  // app.delete('/api/items/:deptCode',(req,res)=>{
  //     const {deptCode} = req.params;
  //     const query = `DELETE FROM DeptMaster WHERE DeptCode=${deptCode}`;
  //     sql.query(query, (err) => {
  //         if (err) {
  //           console.log('Error:', err);
  //           res.status(500).json({ error: 'Internal server error' });
  //         } else {
  //           res.json({ message: 'Item deleted successfully' });
  //         }
  //       });
  // });

  // // For DeptMasterX

  // // GET endpoint to fetch all DeptMasterX entries
  // app.get('/api/deptmastersX', (req, res) => {
  //   const query = 'SELECT * FROM DeptMasterX';
  //   sql.query(query, (err, result) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json(result.recordset);
  //     }
  //   });
  // });

  // // POST endpoint to create a new DeptMasterX entry
  // app.post('/api/deptmastersX', (req, res) => {
  //   const {
  //     DeptCode,
  //     DeptName,
  //     DeptNameENG,
  //     CompCode,
  //     Flag,
  //   } = req.body;
  //   const query = `
  //     INSERT INTO DeptMasterX (DeptCode, DeptName, DeptNameENG, CompCode, Flag)
  //     VALUES ('${DeptCode}', N'${DeptName}', N'${DeptNameENG}', '${CompCode}', N'${Flag}');
  //   `;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'DeptMasterX created successfully' });
  //     }
  //   });
  // });

  // // PUT endpoint to update an existing DeptMasterX entry
  // app.put('/api/deptmastersX/:deptCode', (req, res) => {
  //   const { deptCode } = req.params;
  //   const {
  //     DeptName,
  //     DeptNameENG,
  //     CompCode,
  //     Flag,
  //   } = req.body;
  //   const query = `
  //     UPDATE DeptMasterX
  //     SET DeptName=N'${DeptName}', DeptNameENG=N'${DeptNameENG}', CompCode='${CompCode}', Flag='${Flag}'
  //     WHERE DeptCode='${deptCode}';
  //   `;
  //   sql.query(query, (err, result) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       if (result.rowsAffected && result.rowsAffected[0] > 0) {
  //         res.json({
  //           message: 'DeptMasterX updated successfully',
  //           DeptCode: deptCode,
  //           DeptName,
  //           DeptNameENG,
  //           CompCode,
  //           Flag,
  //         });
  //       } else {
  //         res.status(404).json({ error: 'Record not found' });
  //       }
  //     }
  //   });
  // });

  // // DELETE endpoint to delete a DeptMasterX entry
  // app.delete('/api/deptmastersX/:deptCode', (req, res) => {
  //   const { deptCode } = req.params;
  //   const query = `DELETE FROM DeptMasterX WHERE DeptCode='${deptCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'DeptMasterX deleted successfully' });
  //     }
  //   });
  // });

  //For  designations

  app.get('/api/designations', (req, res) => {
    const query = 'SELECT * FROM DesignationMaster ORDER BY DesigCode';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  app.post('/api/designations', (req, res) => {
    const {
      DesigCode,
      Designation,
      DesignationEng,
      UserID
    } = req.body;

    const query = `
      INSERT INTO DesignationMaster (DesigCode, Designation, DesignationEng,UserID)
      VALUES ('${DesigCode}', N'${Designation}', N'${DesignationEng}',${UserID});
    `;

    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Designation created successfully' });
      }
    });
  });

  app.put('/api/designations/:desigCode', (req, res) => {
    const { desigCode } = req.params;
    const {
      Designation,
      DesignationEng,
      UserID
    } = req.body;

    const query = `
      UPDATE DesignationMaster
      SET Designation=N'${Designation}', DesignationEng=N'${DesignationEng}',UserID=${UserID}
      WHERE DesigCode='${desigCode}';
    `;

    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'Designation updated successfully',
            DesigCode: desigCode,
            Designation,
            DesignationEng,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });
  app.delete('/api/designations/:desigCode', async (req, res) => {
    const { desigCode } = req.params;
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
            const deleteQuery = `DELETE FROM DesignationMaster WHERE DesigCode='${desigCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Designation deleted successfully' });
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
  

  // app.delete('/api/designations/:desigCode', (req, res) => {
  //   const { desigCode } = req.params;
  //   const query = `DELETE FROM DesignationMaster WHERE DesigCode='${desigCode}'`;

  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'Designation deleted successfully' });
  //     }
  //   });
  // });

  // For DistrictMaster ----------

  app.get('/api/DistrictMaster' ,(req,res)=>{
      const query = 'SELECT * FROM DistrictMaster'
      sql.query(query, (err , result)=>{
          if(err){
              console.log('error:', err);
              res.status(500).json({error:'internal server error'});
          }else{
              res.json(result.recordset);
          }
      })
  });

  app.put('/api/UpdateDistrictMaster/:DistrictCode', (req, res) => {
    const { DistrictCode } = req.params;
    const { districtName, stateCode, stdCode,UserID } = req.body;

    const query = `
      UPDATE DistrictMaster
      SET DistrictName=N'${districtName}', StateCode='${stateCode}', STDCode='${stdCode}', UserID=${UserID}
      WHERE DistrictCode=${DistrictCode};
    `;

    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'DistrictMaster updated successfully',
            DistrictCode,
            districtName,
            stateCode,
            stdCode,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });


  app.post('/api/PostDistrictMaster' , (req,res)=>{
      const {DistrictCode, DistrictName , StateCode , StdCode, UserID} = req.body
      const query = `INSERT INTO DistrictMaster (DistrictCode ,DistrictName, StateCode, STDCode, UserID) VALUES (${DistrictCode},N'${DistrictName}',${StateCode},'${StdCode}',${UserID})`;
      sql.query(query, (err) => {
          if (err) {
            console.log('Error:', err);
            res.status(500).json({ error: 'Internal server error' });
          } else {
            res.json({ message: 'Item created successfully' });
          }
        });
  });

  app.delete('/api/DeleteDistrictMaster/:DistrictCode', async (req, res) => {
    const { DistrictCode } = req.params;
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
            const deleteQuery = `DELETE FROM DistrictMaster WHERE DistrictCode='${DistrictCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'District deleted successfully' });
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
  
  // app.delete('/api/DeleteDistrictMaster/:DistrictCode', (req,res)=>{
  //     const {DistrictCode} = req.params;
  //     const query = `DELETE FROM DistrictMaster WHERE DistrictCode=${DistrictCode}`;
  //     sql.query(query, (err) => {
  //         if (err) {
  //           console.log('Error:', err);
  //           res.status(500).json({ error: 'Internal server error' });
  //         } else {
  //           res.json({ message: 'Item deleted successfully' });
  //         }
  //       });
  // });

  // For GSTRate
  // API to get all GSTRates
  app.get('/api/gstrates', (req, res) => {
    const query = 'SELECT * FROM GSTRatesMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // API to create a new GSTRate
  app.post('/api/gstrates', (req, res) => {
    const { GSTRateCode, GSTName, GSTPercent, CGSTPercent, SGSTPercent, IGSTPercent, Remark, UserID} = req.body;
    const query = `
      INSERT INTO GSTRatesMaster (GSTRateCode, GSTName, GSTPercent, CGSTPercent, SGSTPercent, IGSTPercent, Remark, UserID)
      VALUES ('${GSTRateCode}', N'${GSTName}', '${GSTPercent}', '${CGSTPercent}', '${SGSTPercent}', '${IGSTPercent}', '${Remark}',${UserID});
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'GSTRate created successfully' });
      }
    });
  });

  // API to update an existing GSTRate
  app.put('/api/gstrates/:gstrateId', (req, res) => {
    const { gstrateId } = req.params;
    const { GSTName, GSTPercent, CGSTPercent, SGSTPercent, IGSTPercent, Remark, UserID } = req.body;
    const query = `
      UPDATE GSTRatesMaster
      SET GSTName=N'${GSTName}', GSTPercent='${GSTPercent}', CGSTPercent='${CGSTPercent}',
          SGSTPercent='${SGSTPercent}', IGSTPercent='${IGSTPercent}', Remark=N'${Remark}', UserID=${UserID}
      WHERE GSTRateCode='${gstrateId}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'GSTRate updated successfully',
            GSTRateCode: gstrateId,
            GSTName,
            GSTPercent,
            CGSTPercent,
            SGSTPercent,
            IGSTPercent,
            Remark,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // API to delete a GSTRate
  app.delete('/api/gstrates/:gstrateId', async (req, res) => {
    const { gstrateId } = req.params;
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
            const deleteQuery = `DELETE FROM GSTRatesMaster WHERE GSTRateCode='${gstrateId}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'GSTRate deleted successfully' });
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
  
  // app.delete('/api/gstrates/:gstrateId', (req, res) => {
  //   const { gstrateId } = req.params;
  //   const query = `DELETE FROM GSTRatesMaster WHERE GSTRateCode='${gstrateId}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'GSTRate deleted successfully' });
  //     }
  //   });
  // });


  //For itemcategories
  app.get('/api/itemcategories', (req, res) => {
    const query = 'SELECT * FROM ItemCategoryMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  app.post('/api/itemcategories', (req, res) => {
    const {
      ItemCategoryCode,
      ItemCategoryName,
      ItemCategoryNameEng,
      ItemSubGroupCode,
      UserID
    } = req.body;
    const query = `
      INSERT INTO ItemCategoryMaster (ItemCategoryCode, ItemCategoryName, ItemCategoryNameEng, ItemSubGroupCode,UserID)
      VALUES ('${ItemCategoryCode}', N'${ItemCategoryName}', N'${ItemCategoryNameEng}', '${ItemSubGroupCode}',${UserID});
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Item category created successfully' });
      }
    });
  });

  app.put('/api/itemcategories/:itemCategoryId', (req, res) => {
    const { itemCategoryId } = req.params;
    const {
      ItemCategoryName,
      ItemCategoryNameEng,
      ItemSubGroupCode,
      UserID
    } = req.body;
    const query = `
      UPDATE ItemCategoryMaster
      SET ItemCategoryName=N'${ItemCategoryName}', ItemCategoryNameEng=N'${ItemCategoryNameEng}', ItemSubGroupCode='${ItemSubGroupCode}',UserID=${UserID}
      WHERE ItemCategoryCode='${itemCategoryId}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'Item category updated successfully',
            ItemCategoryCode: itemCategoryId,
            ItemCategoryName,
            ItemCategoryNameEng,
            ItemSubGroupCode,
            USERID
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  app.delete('/api/itemcategories/:itemCategoryId', async (req, res) => {
    const { itemCategoryId } = req.params;
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
            const deleteQuery = `DELETE FROM ItemCategoryMaster WHERE ItemCategoryCode='${itemCategoryId}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Item category deleted successfully' });
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
  
  // app.delete('/api/itemcategories/:itemCategoryId', (req, res) => {
  //   const { itemCategoryId } = req.params;
  //   const query = `DELETE FROM ItemCategoryMaster WHERE ItemCategoryCode='${itemCategoryId}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'Item category deleted successfully' });
  //     }
  //   });
  // });

  // For ItemGroupMaster
  app.get('/api/item-groups', (req, res) => {
      const query = 'SELECT * FROM ItemGroupMaster ORDER BY ItemGroupCode ASC';
      sql.query(query, (err, result) => {
        if (err) {
          console.log('Error:', err);
          res.status(500).json({ error: 'Internal server error' });
        } else {
          res.json(result.recordset);
        }
      });
    });
    
    app.post('/api/item-groups', (req, res) => {
      const { ItemGroupCode, ItemGroupName, ItemGroupNameEnglish, Remark1, Remark2, USERID } = req.body;
      const query = `
        INSERT INTO ItemGroupMaster (ItemGroupCode, ItemGroupName, ItemGroupNameEnglish, Remark1, Remark2, USERID)
        VALUES ('${ItemGroupCode}', N'${ItemGroupName}', N'${ItemGroupNameEnglish}', N'${Remark1}', N'${Remark2}', ${USERID});
      `;
      sql.query(query, (err) => {
        if (err) {
          console.log('Error:', err);
          res.status(500).json({ error: 'Internal server error' });
        } else {
          res.json({ message: 'Item group created successfully' });
        }
      });
    });
    
    app.put('/api/item-groups/:ItemGroupCode', (req, res) => {
      const { ItemGroupCode } = req.params;
      const { ItemGroupName, ItemGroupNameEnglish, Remark1, Remark2, USERID } = req.body;
      const query = `
        UPDATE ItemGroupMaster 
        SET ItemGroupName=N'${ItemGroupName}', ItemGroupNameEnglish=N'${ItemGroupNameEnglish}', 
        Remark1=N'${Remark1}', Remark2=N'${Remark2}', USERID=${USERID}
        WHERE ItemGroupCode=${ItemGroupCode};
      `;
      sql.query(query, (err, result) => {
        if (err) {
          console.log('Error:', err);
          res.status(500).json({ error: 'Internal server error' });
        } else {
          if (result.rowsAffected && result.rowsAffected[0] > 0) {
            res.json({
              message: 'Item group updated successfully',
              ItemGroupName,
              ItemGroupNameEnglish,
              Remark1,
              Remark2,
              UserId,
            });
          } else {
            res.status(404).json({ error: 'Record not found' });
          }
        }
      });
    });

    app.delete('/api/item-groups/:ItemGroupCode', async (req, res) => {
      const { ItemGroupCode } = req.params;
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
              const deleteQuery = `DELETE FROM ItemGroupMaster WHERE ItemGroupCode='${ItemGroupCode}'`;
    
              sql.query(deleteQuery, (deleteErr) => {
                if (deleteErr) {
                  console.log('Error deleting entry:', deleteErr);
                  res.status(500).json({ error: 'Internal server error' });
                } else {
                  res.json({ message: 'Item group deleted successfully' });
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
    
      
    // app.delete('/api/item-groups/:ItemGroupCode', (req, res) => {
    //   const { ItemGroupCode } = req.params;
    //   const query = `DELETE FROM ItemGroupMaster WHERE ItemGroupCode=${ItemGroupCode}`;
    //   sql.query(query, (err) => {
    //     if (err) {
    //       console.log('Error:', err);
    //       res.status(500).json({ error: 'Internal server error' });
    //     } else {
    //       res.json({ message: 'Item group deleted successfully' });
    //     }
    //   });
    // });
    


  // For ItemMaster
  app.get('/api/items-master', (req, res) => {
      const query = 'SELECT * FROM ItemMaster';
      sql.query(query, (err, result) => {
        if (err) {
          console.log('Error:', err);
          res.status(500).json({ error: 'Internal server error' });
        } else {
          res.json(result.recordset);
        }
      });
    });
    
  app.post('/api/items-master', (req, res) => {
  const {
      ItCode,
      ItName,
      ItNameEnglish,
      BarCode,
      ItemSubGroupCode,
      ItemCategoryCode,
      UnitCode,
      PackingCode,
      LocationCode,
      HSNCODE,
      GstRateCode,
      Remark1,
      Remark2,
      Remark3,
      Remark4,
      Remark5,
      USERID
  } = req.body;
  const query = `
      INSERT INTO ItemMaster (
      ItCode, ItName, ItNameEnglish, BarCode, ItemSubGroupCode, ItemCategoryCode, 
      UnitCode, PackingCode, LocationCode, HSNCODE, GSTRATECODE, Remark1, Remark2,
      Remark3, Remark4, Remark5, USERID
      )
      VALUES (
      '${ItCode}', N'${ItName}', N'${ItNameEnglish}', '${BarCode}', '${ItemSubGroupCode}', 
      '${ItemCategoryCode}', '${UnitCode}', '${PackingCode}', '${LocationCode}', 
      '${HSNCODE}', ${GstRateCode}, N'${Remark1}', N'${Remark2}', N'${Remark3}', 
      N'${Remark4}', N'${Remark5}', '${USERID}'
      );
  `;
  sql.query(query, (err) => {
      if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
      console.log('USERID:', USERID);
      } else {
      res.json({ message: 'Item created successfully' });
      console.log('USERID:', USERID);
      }
  });
  });
    
  app.put('/api/items-master/:itemId', (req, res) => {
  const { itemId } = req.params;
  const {
      ItName,
      ItNameEnglish,
      BarCode,
      ItemSubGroupCode,
      ItemCategoryCode,
      UnitCode,
      PackingCode,
      LocationCode,
      HSNCODE,
      GstRateCode,
      Remark1,
      Remark2,
      Remark3,
      Remark4,
      Remark5,
      USERID,
  } = req.body;
  const query = `
      UPDATE ItemMaster
      SET 
      ItName=N'${ItName}', ItNameEnglish=N'${ItNameEnglish}', BarCode='${BarCode}',
      ItemSubGroupCode='${ItemSubGroupCode}', ItemCategoryCode='${ItemCategoryCode}',
      UnitCode='${UnitCode}', PackingCode='${PackingCode}', LocationCode='${LocationCode}',
      HSNCODE='${HSNCODE}', GSTRATECODE=${GstRateCode}, Remark1=N'${Remark1}',
      Remark2=N'${Remark2}', Remark3=N'${Remark3}', Remark4=N'${Remark4}', Remark5=N'${Remark5}',
      USERID='${USERID}'
      WHERE ItCode='${itemId}';
  `;
  sql.query(query, (err, result) => {
      if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
      } else {
      if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
          message: 'Item updated successfully',
          ItName,
          ItNameEnglish,
          BarCode,
          ItemSubGroupCode,
          ItemCategoryCode,
          UnitCode,
          PackingCode,
          LocationCode,
          HSNCODE,
          GstRateCode,
          Remark1,
          Remark2,
          Remark3,
          Remark4,
          Remark5,
          USERID,
          });
      } else {
          res.status(404).json({ error: 'Record not found' });
      }
      }
  });
  });
    
  // app.delete('/api/items-master/:itemId', (req, res) => {
  // const { itemId } = req.params;
  // const query = `DELETE FROM ItemMaster WHERE ItCode=${itemId}`;
  // sql.query(query, (err) => {
  //     if (err) {
  //     console.log('Error:', err);
  //     res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //     res.json({ message: 'Item deleted successfully' });
  //     }
  // });
  // });

  app.delete('/api/items-master/:itemId', async (req, res) => {
    const { itemId } = req.params;
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
            const deleteQuery = `DELETE FROM ItemMaster WHERE ItCode='${itemId}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Item deleted successfully' });
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
  
    
  //For ItemSubGroupMaster


  app.get('/api/itemsubgroups', (req, res) => {
    // Replace with your SQL SELECT query
    const query = 'SELECT * FROM ItemSubGroupMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset); // Assuming result is an array of itemSubGroups
      }
    });
  });

  app.post('/api/itemsubgroups', (req, res) => {
    const { ItemSubGroupCode, ItemSubGroupName, ItemSubGroupNameEnglish, ItemMainGroupCode } = req.body;
    // Replace with your SQL INSERT query
    const query = `
      INSERT INTO ItemSubGroupMaster (ItemSubGroupCode, ItemSubGroupName, ItemSubGroupNameEnglish, ItemMainGroupCode)
      VALUES ('${ItemSubGroupCode}', N'${ItemSubGroupName}', N'${ItemSubGroupNameEnglish}', '${ItemMainGroupCode}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'ItemSubGroup created successfully' });
      }
    });
  });

  app.put('/api/itemsubgroups/:ItemSubGroupCode', (req, res) => {
    const { ItemSubGroupCode } = req.params;
    const { ItemSubGroupName, ItemSubGroupNameEnglish, ItemMainGroupCode } = req.body;
    // Replace with your SQL UPDATE query
    const query = `
      UPDATE ItemSubGroupMaster
      SET ItemSubGroupName=N'${ItemSubGroupName}', ItemSubGroupNameEnglish=N'${ItemSubGroupNameEnglish}', ItemMainGroupCode='${ItemMainGroupCode}'
      WHERE ItemSubGroupCode='${ItemSubGroupCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        console.log('Result:', result);
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'ItemSubGroup updated successfully',
            ItemSubGroupCode: ItemSubGroupCode,
            ItemSubGroupName,
            ItemSubGroupNameEnglish,
            ItemMainGroupCode,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // app.delete('/api/itemsubgroups/:itemSubGroupCode', (req, res) => {
  //   const { itemSubGroupCode } = req.params;
  //   // Replace with your SQL DELETE query
  //   const query = `DELETE FROM ItemSubGroupMaster WHERE ItemSubGroupCode='${itemSubGroupCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.error('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'ItemSubGroup deleted successfully' });
  //     }
  //   });
  // });

  app.delete('/api/itemsubgroups/:itemSubGroupCode', async (req, res) => {
    const { itemSubGroupCode } = req.params;
    const UserName = req.headers['username'];
  
    try {
      // Fetch user permissions from the database based on the user making the request
      const userPermissionsQuery = `SELECT AllowMasterDelete FROM Users WHERE UserName='${UserName}'`;
  
      sql.query(userPermissionsQuery, async (userErr, userResults) => {
        if (userErr) {
          console.error('Error fetching user permissions:', userErr);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
  
        // Check if user results are not empty
        if (userResults.recordset && userResults.recordset.length > 0) {
          // Check if user has permission to delete entries
          const { AllowMasterDelete } = userResults.recordset[0];
  
          if (AllowMasterDelete === 1) {
            // The user has permission to delete entries
            const deleteQuery = `DELETE FROM ItemSubGroupMaster WHERE ItemSubGroupCode='${itemSubGroupCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.error('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'ItemSubGroup deleted successfully' });
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
  


  // For LedgerMaster
  // Get all LedgerMaster entries
  app.get('/api/ledger-master', (req, res) => {
      const query = 'SELECT * FROM LedgerMaster';
      sql.query(query, (err, result) => {
        if (err) {
          console.log('Error:', err);
          res.status(500).json({ error: 'Internal server error' });
        } else {
          res.json(result.recordset);
        }
      });
    });
    
    // Create a new LedgerMaster entry
    app.post('/api/ledger-master', (req, res) => {
      const {
        AcCode,
        AcGroupCode,
        AcHead,
        AcHeadEng,
        DetailYN,
        Address1,
        Address2,
        City,
        MobileNo,
        Email,
        AadharCardNo,
        PanNo,
        GSTNo,
        Remark1,
        Remark2,
        Remark3,
        Remark4,
        Remark5,
        StateCode,
        UserID
      } = req.body;
    
      const query = `
        INSERT INTO LedgerMaster (
        AcCode,
        AcGroupCode,
        AcHead,
        AcHeadEng,
        DetailYN,
        Address1,
        Address2,
        City,
        MobileNo,
        Email,
        AadharCardNo,
        PANo,
        GSTNo,
        Remark1,
        Remark2,
        Remark3,
        Remark4,
        Remark5,
        StateCode,
        UserID
        )
        VALUES (
          '${AcCode}',
          '${AcGroupCode}',
          N'${AcHead}',
          N'${AcHeadEng}',
          N'${DetailYN}',
          N'${Address1}',
          N'${Address2}',
          N'${City}',
          '${MobileNo}',
          '${Email}',
          '${AadharCardNo}',
          '${PanNo}',
          '${GSTNo}',
          N'${Remark1}',
          N'${Remark2}',
          N'${Remark3}',
          N'${Remark4}',
          N'${Remark5}',
          '${StateCode}',
          '${UserID}'
        );
      `;
    
      sql.query(query, (err) => {
        if (err) {
          console.log('Error:', err);
          res.status(500).json({ error: 'Internal server error' });
        } else {
          res.json({ message: 'Ledger entry created successfully' });
        }
      });
    });
    
    // Update a LedgerMaster entry by AcCode
    app.put('/api/ledger-master/:AcCode', (req, res) => {
      const { AcCode } = req.params;
      const {
        AcGroupCode,
        AcHead,
        AcHeadEng,
        DetailYN,
        Address1,
        Address2,
        City,
        MobileNo,
        Email,
        AadharCardNo,
        PanNo,
        GSTNo,
        Remark1,
        Remark2,
        Remark3,
        Remark4,
        Remark5,
        StateCode,
        UserID
      } = req.body;
    
      const query = `
        UPDATE LedgerMaster
        SET
          AcGroupCode='${AcGroupCode}',
          AcHead=N'${AcHead}',
          AcHeadEng=N'${AcHeadEng}',
          DetailYN=N'${DetailYN}',
          Address1=N'${Address1}',
          Address2=N'${Address2}',
          City=N'${City}',
          MobileNo='${MobileNo}',
          Email='${Email}',
          AadharCardNo='${AadharCardNo}',
          PANo=N'${PanNo}',
          GSTNo=N'${GSTNo}',
          Remark1=N'${Remark1}',
          Remark2=N'${Remark2}',
          Remark3=N'${Remark3}',
          Remark4=N'${Remark4}',
          Remark5=N'${Remark5}',
          StateCode='${StateCode}',
          UserID='${UserID}'
        WHERE AcCode='${AcCode}';
      `;
    
      sql.query(query, (err, result) => {
        if (err) {
          console.log('Error:', err);
          res.status(500).json({ error: 'Internal server error' });
        } else {
          if (result.rowsAffected && result.rowsAffected[0] > 0) {
            res.json({
              message: 'Ledger entry updated successfully',
              AcCode,
              AcGroupCode,
              AcHead,
              AcHeadEng,
              DetailYN,
              Address1,
              Address2,
              City,
              MobileNo,
              Email,
              AadharCardNo,
              PanNo,
              GSTNo,
              Remark1,
              Remark2,
              Remark3,
              Remark4,
              Remark5,
              StateCode,
              UserID
            });
          } else {
            res.status(404).json({ error: 'Record not found' });
          }
        }
      });
    });
    
    // Delete a LedgerMaster entry by AcCode
    // app.delete('/api/ledger-master/:AcCode', (req, res) => {
    //   const { AcCode } = req.params;
    //   const query = `DELETE FROM LedgerMaster WHERE AcCode='${AcCode}'`;
    //   sql.query(query, (err) => {
    //     if (err) {
    //       console.log('Error:', err);
    //       res.status(500).json({ error: 'Internal server error' });
    //     } else {
    //       res.json({ message: 'Ledger entry deleted successfully' });
    //     }
    //   });
    // });

    app.delete('/api/ledger-master/:AcCode', async (req, res) => {
      const { AcCode } = req.params;
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
              const deleteQuery = `DELETE FROM LedgerMaster WHERE AcCode='${AcCode}'`;
    
              sql.query(deleteQuery, (deleteErr) => {
                if (deleteErr) {
                  console.log('Error deleting entry:', deleteErr);
                  res.status(500).json({ error: 'Internal server error' });
                } else {
                  res.json({ message: 'Ledger entry deleted successfully' });
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
    



  // For Location master

  // GET endpoint to fetch all locations
  app.get('/api/locations', (req, res) => {
    const query = 'SELECT * FROM LocationMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // POST endpoint to create a new location
  app.post('/api/locations', (req, res) => {
    const { LocationCode, LocationName , UserID } = req.body;
    const query = `
      INSERT INTO LocationMaster (LocationCode, LocationName,UserID)
      VALUES (N'${LocationCode}', N'${LocationName}',${UserID});
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Location created successfully' });
      }
    });
  });

  // PUT endpoint to update a location
  app.put('/api/locations/:locationCode', (req, res) => {
    const { locationCode } = req.params;
    const { LocationName, UserID } = req.body;
    const query = `
      UPDATE LocationMaster
      SET LocationName=N'${LocationName}',UserID=${UserID}
      WHERE LocationCode=N'${locationCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'Location updated successfully',
            LocationCode: locationCode,
            LocationName,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // DELETE endpoint to delete a location
  // app.delete('/api/locations/:locationCode', (req, res) => {
  //   const { locationCode } = req.params;
  //   const query = `DELETE FROM LocationMaster WHERE LocationCode='${locationCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'Location deleted successfully' });
  //     }
  //   });
  // });

  app.delete('/api/locations/:locationCode', async (req, res) => {
    const { locationCode } = req.params;
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
            const deleteQuery = `DELETE FROM LocationMaster WHERE LocationCode='${locationCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Location deleted successfully' });
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
  

  // for narration 

    app.get('/api/narrations', (req, res) => {
      const query = 'SELECT * FROM NarrationMaster';
      sql.query(query, (err, result) => {
        if (err) {
          console.log('Error:', err);
          res.status(500).json({ error: 'Internal server error' });
        } else {
          res.json(result.recordset);
        }
      });
    });

    
    app.post('/api/narrations', (req, res) => {
      const {
        Srno,
        Narration,
        Narration1,
        UserID
      } = req.body;
      const query = `
        INSERT INTO NarrationMaster (Srno, Narration, Narration1,UserID)
        VALUES ('${Srno}', N'${Narration}', N'${Narration1}',${UserID});
      `;
      sql.query(query, (err) => {
        if (err) {
          console.log('Error:', err);
          res.status(500).json({ error: 'Internal server error' });
        } else {
          res.json({ message: 'Narration created successfully' });
        }
      });
    });

    
    app.put('/api/narrations/:narrationId', (req, res) => {
      const { narrationId } = req.params;
      const {
        Narration,
        Narration1,
        UserID
      } = req.body;
      const query = `
        UPDATE NarrationMaster
        SET Narration=N'${Narration}', Narration1=N'${Narration1}',UserID=${UserID}
        WHERE Srno=N'${narrationId}';
      `;
      sql.query(query, (err, result) => {
        if (err) {
          console.log('Error:', err);
          res.status(500).json({ error: 'Internal server error' });
        } else {
          if (result.rowsAffected && result.rowsAffected[0] > 0) {
            res.json({
              message: 'Narration updated successfully',
              Srno: narrationId,
              Narration,
              Narration1,
            });
          } else {
            res.status(404).json({ error: 'Record not found' });
          }
        }
      });
    });

    // app.delete('/api/narrations/:narrationId', (req, res) => {
    //   const { narrationId } = req.params;
    //   const query = `DELETE FROM NarrationMaster WHERE Srno='${narrationId}'`;
    //   sql.query(query, (err) => {
    //     if (err) {
    //       console.log('Error:', err);
    //       res.status(500).json({ error: 'Internal server error' });
    //     } else {
    //       res.json({ message: 'Narration deleted successfully' });
    //     }
    //   });
    // });

    app.delete('/api/narrations/:narrationId', async (req, res) => {
      const { narrationId } = req.params;
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
              const deleteQuery = `DELETE FROM NarrationMaster WHERE Srno='${narrationId}'`;
    
              sql.query(deleteQuery, (deleteErr) => {
                if (deleteErr) {
                  console.log('Error deleting entry:', deleteErr);
                  res.status(500).json({ error: 'Internal server error' });
                } else {
                  res.json({ message: 'Narration deleted successfully' });
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
    
    

  // For PackingMaster


  app.get('/api/packing', (req, res) => {
    const query = 'SELECT * FROM PackingMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  app.post('/api/packing', (req, res) => {
    const { PackingCode, PackingName, ConversionFactor,UserID } = req.body;
    const query = `
      INSERT INTO PackingMaster (PackingCode, PackingName, ConversionFactor,UserID)
      VALUES ('${PackingCode}', N'${PackingName}', '${ConversionFactor}',${UserID});
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Packing item created successfully' });
      }
    });
  });

  app.put('/api/packing/:packingCode', (req, res) => {
    const { packingCode } = req.params;
    const { PackingName, ConversionFactor,UserID} = req.body;
    const query = `
      UPDATE PackingMaster
      SET PackingName=N'${PackingName}', ConversionFactor='${ConversionFactor}', UserID=${UserID}
      WHERE PackingCode='${packingCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'Packing item updated successfully',
            PackingCode: packingCode,
            PackingName,
            ConversionFactor,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // app.delete('/api/packing/:packingCode', (req, res) => {
  //   const { packingCode } = req.params;
  //   const query = `DELETE FROM PackingMaster WHERE PackingCode='${packingCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'Packing item deleted successfully' });
  //     }
  //   });
  // });

  app.delete('/api/packing/:packingCode', async (req, res) => {
    const { packingCode } = req.params;
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
            const deleteQuery = `DELETE FROM PackingMaster WHERE PackingCode='${packingCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Packing item deleted successfully' });
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
  
    
  // for statemaster 

  // Get all states
  app.get('/api/states', (req, res) => {
    const query = 'SELECT * FROM StateMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // Create a new state
  app.post('/api/states', (req, res) => {
    const { StateCode, StateName } = req.body;
    const query = `
      INSERT INTO StateMaster (StateCode, StateName)
      VALUES ('${StateCode}', N'${StateName}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'State created successfully' });
      }
    });
  });

  // Update a state by StateCode
  app.put('/api/states/:stateCode', (req, res) => {
    const { stateCode } = req.params;
    const { StateName } = req.body;
    const query = `
      UPDATE StateMaster
      SET StateName=N'${StateName}'
      WHERE StateCode='${stateCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'State updated successfully',
            StateCode: stateCode,
            StateName,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // Delete a state by StateCode
  // app.delete('/api/states/:stateCode', (req, res) => {
  //   const { stateCode } = req.params;
  //   const query = `DELETE FROM StateMaster WHERE StateCode='${stateCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'State deleted successfully' });
  //     }
  //   });
  // });

  app.delete('/api/states/:stateCode', async (req, res) => {
    const { stateCode } = req.params;
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
            const deleteQuery = `DELETE FROM StateMaster WHERE StateCode='${stateCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'State deleted successfully' });
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
  


  // GET SubLedgerGroupMaster entries
  app.get('/api/subledgergroups', (req, res) => {
    const query = 'SELECT * FROM SubLedgerGroupMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // POST SubLedgerGroupMaster entry
  app.post('/api/subledgergroups', (req, res) => {
    const {
      SubLedgerGroupCode,
      SubLedgerGroupName,
      SubLedgerGroupNameEng,
      ShortKey,
    } = req.body;
    const query = `
      INSERT INTO SubLedgerGroupMaster (SubLedgerGroupCode, SubLedgerGroupName, SubLedgerGroupNameEng, ShortKey)
      VALUES ('${SubLedgerGroupCode}', N'${SubLedgerGroupName}', N'${SubLedgerGroupNameEng}', '${ShortKey}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'SubLedgerGroup created successfully' });
      }
    });
  });

  // PUT SubLedgerGroupMaster entry
  app.put('/api/subledgergroups/:subledgergroupId', (req, res) => {
    const { subledgergroupId } = req.params;
    const {
      SubLedgerGroupName,
      SubLedgerGroupNameEng,
      ShortKey,
    } = req.body;
    const query = `
      UPDATE SubLedgerGroupMaster
      SET SubLedgerGroupName=N'${SubLedgerGroupName}', SubLedgerGroupNameEng=N'${SubLedgerGroupNameEng}', ShortKey='${ShortKey}'
      WHERE SubLedgerGroupCode='${subledgergroupId}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'SubLedgerGroup updated successfully',
            SubLedgerGroupCode: subledgergroupId,
            SubLedgerGroupName,
            SubLedgerGroupNameEng,
            ShortKey,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // DELETE SubLedgerGroupMaster entry
  // app.delete('/api/subledgergroups/:subledgergroupId', (req, res) => {
  //   const { subledgergroupId } = req.params;
  //   const query = `DELETE FROM SubLedgerGroupMaster WHERE SubLedgerGroupCode='${subledgergroupId}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'SubLedgerGroup deleted successfully' });
  //     }
  //   });
  // });

  app.delete('/api/subledgergroups/:subledgergroupId', async (req, res) => {
    const { subledgergroupId } = req.params;
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
            const deleteQuery = `DELETE FROM SubLedgerGroupMaster WHERE SubLedgerGroupCode='${subledgergroupId}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'SubLedgerGroup deleted successfully' });
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
  

  //subledgermaster

  // GET SubLedgerGroupMaster entries
  app.get('/api/subledgerMaster', (req, res) => {
    const query = 'SELECT * FROM SubLedgerMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // Create a new SubLedgerMaster
  app.post('/api/subledgerMaster', (req, res) => {
    const {
      SubAcCode,
      SubLedgerGroupCode,
      SubSrNo,
      SubAcHead,
      SubAcHeadEng,
      Address1,
      Address2,
      StateCode,
      PhoneNo,
      MobileNo,
      Email,
      AadharCardNo,
      BankName,
      BankAcNo,
      PANo,
      GSTNO,
      Remark1,
      Remark2,
      Remark3,
      StatusCode,
      USERID,
    } = req.body;

    const query = `
      INSERT INTO SubLedgerMaster (SubAcCode, SubLedgerGroupCode, SubSrNo, SubAcHead, SubAcHeadEng,
        Address1, Address2, StateCode, PhoneNo, MobileNo, Email, AadharCardNo, BankName, BankAcNo,
        PANo, GSTNO, Remark1, Remark2, Remark3, StatusCode, USERID)
      VALUES ('${SubAcCode}', '${SubLedgerGroupCode}', '${SubSrNo}', N'${SubAcHead}', '${SubAcHeadEng}',
        N'${Address1}', N'${Address2}', '${StateCode}', '${PhoneNo}', '${MobileNo}', '${Email}',
        '${AadharCardNo}', N'${BankName}', '${BankAcNo}', '${PANo}', '${GSTNO}', N'${Remark1}',
        N'${Remark2}', N'${Remark3}', '${StatusCode}', N'${USERID}');
    `;

    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'SubLedgerMaster created successfully' });
      }
    });
  });

  // Update a SubLedgerMaster by SubAcCode
  app.put('/api/subledgerMaster/:SubAcCode', (req, res) => {
    const { SubAcCode } = req.params;
    const {
      SubLedgerGroupCode,
      SubSrNo,
      SubAcHead,
      SubAcHeadEng,
      Address1,
      Address2,
      StateCode,
      PhoneNo,
      MobileNo,
      Email,
      AadharCardNo,
      BankName,
      BankAcNo,
      PANo,
      GSTNO,
      Remark1,
      Remark2,
      Remark3,
      StatusCode,
      USERID,
    } = req.body;

    const query = `
    UPDATE SubLedgerMaster
    SET SubLedgerGroupCode='${SubLedgerGroupCode}', SubSrNo='${SubSrNo}', SubAcHead=N'${SubAcHead}',
      SubAcHeadEng=N'${SubAcHeadEng}', Address1=N'${Address1}', Address2=N'${Address2}',
      StateCode='${StateCode}', PhoneNo='${PhoneNo}', MobileNo='${MobileNo}', Email='${Email}',
      AadharCardNo='${AadharCardNo}', BankName=N'${BankName}', BankAcNo='${BankAcNo}', PANo='${PANo}',
      GSTNO='${GSTNO}', Remark1=N'${Remark1}', Remark2=N'${Remark2}', Remark3=N'${Remark3}',
      StatusCode='${StatusCode}', USERID='${USERID}'
      WHERE SubAcCode='${SubAcCode}';
  `;

    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'SubLedgerMaster updated successfully',
            SubAcCode,
            // ... (other fields)
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // Delete a SubLedgerMaster by SubAcCode
  // app.delete('/api/subledgerMaster/:SubAcCode', (req, res) => {
  //   const { SubAcCode } = req.params;

  //   const query = `DELETE FROM SubLedgerMaster WHERE SubAcCode='${SubAcCode}'`;

  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'SubLedgerMaster deleted successfully' });
  //     }
  //   });
  // });

  app.delete('/api/subledgerMaster/:SubAcCode', async (req, res) => {
    const { SubAcCode } = req.params;
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
            const deleteQuery = `DELETE FROM SubLedgerMaster WHERE SubAcCode='${SubAcCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'SubLedgerMaster deleted successfully' });
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
  


  //taluka master 
  // Get all Talukas
  app.get('/api/talukas', (req, res) => {
    const query = 'SELECT * FROM TalukaMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // Create a new Taluka
  app.post('/api/talukas', (req, res) => {
    const {
      TalukaCode,
      TalukaName,
      DistrictCode,
      DeptCode,
      YearCode,
      UserID,
    } = req.body;
    const query = `
      INSERT INTO TalukaMaster (TalukaCode, TalukaName, DistrictCode, DeptCode, YearCode, UserID)
      VALUES ('${TalukaCode}', N'${TalukaName}', '${DistrictCode}', '${DeptCode}', '${YearCode}', '${UserID}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Taluka created successfully' });
      }
    });
  });

  // Update an existing Taluka
  app.put('/api/talukas/:talukaId', (req, res) => {
    const { talukaId } = req.params;
    const {
      TalukaName,
      DistrictCode,
      DeptCode,
      YearCode,
      UserID,
    } = req.body;
    const query = `
      UPDATE TalukaMaster
      SET TalukaName=N'${TalukaName}', DistrictCode='${DistrictCode}', DeptCode='${DeptCode}', YearCode='${YearCode}', UserID='${UserID}'
      WHERE TalukaCode='${talukaId}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'Taluka updated successfully',
            TalukaCode: talukaId,
            TalukaName,
            DistrictCode,
            DeptCode,
            YearCode,
            UserID,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // Delete a Taluka
  app.delete('/api/talukas/:talukaId', async (req, res) => {
    const { talukaId } = req.params;
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
            const deleteQuery = `DELETE FROM TalukaMaster WHERE TalukaCode='${talukaId}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Taluka deleted successfully' });
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
  
  // app.delete('/api/talukas/:talukaId', (req, res) => {
  //   const { talukaId } = req.params;
  //   const query = `DELETE FROM TalukaMaster WHERE TalukaCode='${talukaId}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'Taluka deleted successfully' });
  //     }
  //   });
  // });

  //TranGroupMaster entries
  // GET all TranGroupMaster entries
  app.get('/api/trangroups', (req, res) => {
    const query = 'SELECT * FROM TranGroupMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // POST a new TranGroupMaster entry
  app.post('/api/trangroups', (req, res) => {
    const {
      AcGroupCode,
      OpBal,
      TOpBal,
      TDebit,
      TCredit,
      TCurBal,
      DeptCode,
      YearCode,
      UserID,
    } = req.body;
    const query = `
      INSERT INTO TranGroupMaster (AcGroupCode, OpBal, TOpBal, TDebit, TCredit, TCurBal, DeptCode, YearCode, UserID)
      VALUES ('${AcGroupCode}', '${OpBal}', '${TOpBal}', '${TDebit}', '${TCredit}', '${TCurBal}', '${DeptCode}', '${YearCode}', '${UserID}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'TranGroup created successfully' });
      }
    });
  });

  // PUT (update) a TranGroupMaster entry by AcGroupCode
  app.put('/api/trangroups/:acGroupCode', (req, res) => {
    const { acGroupCode } = req.params;
    const {
      OpBal,
      TOpBal,
      TDebit,
      TCredit,
      TCurBal,
      DeptCode,
      YearCode,
      UserID,
    } = req.body;
    const query = `
      UPDATE TranGroupMaster
      SET OpBal='${OpBal}', TOpBal='${TOpBal}', TDebit='${TDebit}', TCredit='${TCredit}', 
          TCurBal='${TCurBal}', DeptCode='${DeptCode}', YearCode='${YearCode}', UserID='${UserID}'
      WHERE AcGroupCode='${acGroupCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'TranGroup updated successfully',
            AcGroupCode,
            OpBal,
            TOpBal,
            TDebit,
            TCredit,
            TCurBal,
            DeptCode,
            YearCode,
            UserID,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // DELETE a TranGroupMaster entry by AcGroupCode
  app.delete('/api/trangroups/:acGroupCode', async (req, res) => {
    const { acGroupCode } = req.params;
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
            const deleteQuery = `DELETE FROM TranGroupMaster WHERE AcGroupCode='${acGroupCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'TranGroup deleted successfully' });
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
  
  // app.delete('/api/trangroups/:acGroupCode', (req, res) => {
  //   const { acGroupCode } = req.params;
  //   const query = `DELETE FROM TranGroupMaster WHERE AcGroupCode='${acGroupCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'TranGroup deleted successfully' });
  //     }
  //   });
  // });


  //TranItMaster entries
  // Get all TranItMaster entries
  app.get('/api/tranItMaster', (req, res) => {
    const query = 'SELECT * FROM TranItMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // Create a new TranItMaster entry
  app.post('/api/tranItMaster', (req, res) => {
    const {
      YearCode,
      DeptCode,
      ItCode,
      Rate,
      OpQty,
      OpWt,
      OpAmt,
      ClQty,
      ClWt,
      ClAmt,
      UserID
    } = req.body;
    const query = `
      INSERT INTO TranItMaster (YearCode, DeptCode, ItCode, Rate, OpQty, OpWt, OpAmt, ClQty, ClWt, ClAmt,UserID)
      VALUES ('${YearCode}', '${DeptCode}', '${ItCode}', '${Rate}', '${OpQty}', '${OpWt}', '${OpAmt}', '${ClQty}', '${ClWt}', '${ClAmt}',${UserID});
    `;
    sql.query(query, (err) => {
      if (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'TranItMaster created successfully' });
      }
    });
  });

  // Update an existing TranItMaster entry
  app.put('/api/tranItMaster/:DeptCode/:ItCode', (req, res) => {
    const {  DeptCode, ItCode } = req.params;
    const {
      YearCode,
      Rate,
      OpQty,
      OpWt,
      OpAmt,
      ClQty,
      ClWt,
      ClAmt,
      UserID
    } = req.body;
    const query = `
      UPDATE TranItMaster
      SET YearCode='${YearCode}', DeptCode='${DeptCode}', ItCode='${ItCode}', Rate='${Rate}', 
          OpQty='${OpQty}', OpWt='${OpWt}', OpAmt='${OpAmt}', ClQty='${ClQty}', ClWt='${ClWt}', ClAmt='${ClAmt}',UserID=${UserID}
      WHERE DeptCode='${DeptCode}' AND ItCode='${ItCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'TranItMaster updated successfully',
            YearCode,
            DeptCode,
            ItCode,
            Rate,
            OpQty,
            OpWt,
            OpAmt,
            ClQty,
            ClWt,
            ClAmt,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // Delete a TranItMaster entry
  app.delete('/api/tranItMaster/:DeptCode/:ItCode', async (req, res) => {
    const { DeptCode, ItCode } = req.params;
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
            const deleteQuery = `DELETE FROM TranItMaster WHERE DeptCode='${DeptCode}' AND ItCode='${ItCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'TranItMaster deleted successfully' });
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
  
  // app.delete('/api/tranItMaster/:DeptCode/:ItCode', (req, res) => {
  //   const {  DeptCode, ItCode  } = req.params;
  //   const query = `DELETE FROM TranItMaster WHERE DeptCode='${DeptCode}' AND ItCode='${ItCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.error('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'TranItMaster deleted successfully' });
  //     }
  //   });
  // });

  //TranLedgerMaster
  // GET all TranLedgerMaster entries
  app.get('/api/tranledgers', (req, res) => {
    const query = 'SELECT * FROM TranLedgerMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // POST a new TranLedgerMaster entry
  app.post('/api/tranledgers', (req, res) => {
    const {
      AcCode,
      OpBal,
      TOpBal,
      TDebit,
      TCredit,
      TCurBal,
      DeptCode,
      YearCode,
      UserID,
    } = req.body;
    const query = `
      INSERT INTO TranLedgerMaster (AcCode, OpBal, TOpBal, TDebit, TCredit, TCurBal, DeptCode, YearCode, UserID)
      VALUES ('${AcCode}', '${OpBal}', '${TOpBal}', '${TDebit}', '${TCredit}', '${TCurBal}', '${DeptCode}', '${YearCode}', '${UserID}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'TranLedger created successfully' });
      }
    });
  });

  // PUT (Update) an existing TranLedgerMaster entry
  app.put('/api/tranledgers/:AcCode', (req, res) => {
    const { AcCode } = req.params;
    const {
      OpBal,
      TOpBal,
      TDebit,
      TCredit,
      TCurBal,
      DeptCode,
      YearCode,
      UserID,
    } = req.body;
    const query = `
      UPDATE TranLedgerMaster
      SET OpBal='${OpBal}', TOpBal='${TOpBal}', TDebit='${TDebit}', TCredit='${TCredit}', TCurBal='${TCurBal}', 
      DeptCode='${DeptCode}', YearCode='${YearCode}', UserID='${UserID}'
      WHERE AcCode='${AcCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'TranLedger updated successfully',
            AcCode: AcCode,
            OpBal,
            TOpBal,
            TDebit,
            TCredit,
            TCurBal,
            DeptCode,
            YearCode,
            UserID,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // DELETE a TranLedgerMaster entry
  app.delete('/api/tranledgers/:AcCode', async (req, res) => {
    const { AcCode } = req.params;
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
            const deleteQuery = `DELETE FROM TranLedgerMaster WHERE AcCode='${AcCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'TranLedger deleted successfully' });
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
  
  // app.delete('/api/tranledgers/:AcCode', (req, res) => {
  //   const { AcCode } = req.params;
  //   const query = `DELETE FROM TranLedgerMaster WHERE AcCode='${AcCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'TranLedger deleted successfully' });
  //     }
  //   });
  // });


  //TranLedgerMasterTemp

  // Get all ledger entries
  app.get('/api/ledgerentries', (req, res) => {
    const query = 'SELECT * FROM TranLedgerMasterTemp';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // Create a new ledger entry
  app.post('/api/ledgerentries', (req, res) => {
    const {
      AcCode,
      OpBal,
      TOpBal,
      TDebit,
      TCredit,
      TCurBal,
      DeptCode,
      YearCode,
      UserID,
    } = req.body;
    const query = `
      INSERT INTO TranLedgerMasterTemp (AcCode, OpBal, TOpBal, TDebit, TCredit, TCurBal, DeptCode, YearCode, UserID)
      VALUES (${AcCode}, ${OpBal}, ${TOpBal}, ${TDebit}, ${TCredit}, ${TCurBal}, ${DeptCode}, ${YearCode}, '${UserID}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Ledger entry created successfully' });
      }
    });
  });

  // Update a ledger entry
  app.put('/api/ledgerentries/:acCode', (req, res) => {
    const { acCode } = req.params;
    const {
      OpBal,
      TOpBal,
      TDebit,
      TCredit,
      TCurBal,
      DeptCode,
      YearCode,
      UserID,
    } = req.body;
    const query = `
      UPDATE TranLedgerMasterTemp
      SET OpBal=${OpBal}, TOpBal=${TOpBal}, TDebit=${TDebit}, TCredit=${TCredit},
          TCurBal=${TCurBal}, DeptCode=${DeptCode}, YearCode=${YearCode}, UserID='${UserID}'
      WHERE AcCode=${acCode};
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'Ledger entry updated successfully',
            AcCode: acCode,
            OpBal,
            TOpBal,
            TDebit,
            TCredit,
            TCurBal,
            DeptCode,
            YearCode,
            UserID,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // Delete a ledger entry
  app.delete('/api/ledgerentries/:acCode', async (req, res) => {
    const { acCode } = req.params;
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
            const deleteQuery = `DELETE FROM TranLedgerMasterTemp WHERE AcCode=${acCode}`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Ledger entry deleted successfully' });
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
  
  // app.delete('/api/ledgerentries/:acCode', (req, res) => {
  //   const { acCode } = req.params;
  //   const query = `DELETE FROM TranLedgerMasterTemp WHERE AcCode=${acCode}`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'Ledger entry deleted successfully' });
  //     }
  //   });
  // });

  //TranSubLedger entries
  // Get all TranSubLedger entries
  app.get('/api/tranSubLedgers', (req, res) => {
    const query = 'SELECT * FROM TranSubLedgerMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // Create a new TranSubLedger entry
  app.post('/api/tranSubLedgers', (req, res) => {
    const {
      AcCode,
      SubAcCode,
      OpBal,
      TOpBal,
      Debit,
      Credit,
      CurBal,
      DeptCode,
      YearCode,
      UserID,
      SubLedgerGroupCode,
    } = req.body;
    const query = `
      INSERT INTO TranSubLedgerMaster (AcCode, SubAcCode, OpBal, TOpBal, Debit, Credit, CurBal, DeptCode, YearCode, UserID, SubLedgerGroupCode)
      VALUES ('${AcCode}', '${SubAcCode}', '${OpBal}', '${TOpBal}', '${Debit}', '${Credit}', '${CurBal}', '${DeptCode}', '${YearCode}', '${UserID}', '${SubLedgerGroupCode}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'TranSubLedger created successfully' });
      }
    });
  });

  // Update a TranSubLedger entry
  app.put('/api/tranSubLedgers/:acCode', (req, res) => {
    const { acCode } = req.params;
    const {
      SubAcCode,
      OpBal,
      TOpBal,
      Debit,
      Credit,
      CurBal,
      DeptCode,
      YearCode,
      UserID,
      SubLedgerGroupCode,
    } = req.body;
    const query = `
      UPDATE TranSubLedgerMaster
      SET SubAcCode='${SubAcCode}', OpBal='${OpBal}', TOpBal='${TOpBal}', Debit='${Debit}', Credit='${Credit}', CurBal='${CurBal}', DeptCode='${DeptCode}', YearCode='${YearCode}', UserID='${UserID}', SubLedgerGroupCode='${SubLedgerGroupCode}'
      WHERE AcCode='${acCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'TranSubLedger updated successfully',
            AcCode: acCode,
            SubAcCode,
            OpBal,
            TOpBal,
            Debit,
            Credit,
            CurBal,
            DeptCode,
            YearCode,
            UserID,
            SubLedgerGroupCode,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // Delete a TranSubLedger entry
  app.delete('/api/tranSubLedgers/:acCode', async (req, res) => {
    const { acCode } = req.params;
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
            const deleteQuery = `DELETE FROM TranSubLedgerMaster WHERE AcCode='${acCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'TranSubLedger deleted successfully' });
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
  
  // app.delete('/api/tranSubLedgers/:acCode', (req, res) => {
  //   const { acCode } = req.params;
  //   const query = `DELETE FROM TranSubLedgerMaster WHERE AcCode='${acCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'TranSubLedger deleted successfully' });
  //     }
  //   });
  // });

  //TranSubLedgerMasterTemp
  // GET all TranSubLedgerMasterTemp entries
  app.get('/api/entries', (req, res) => {
    const query = 'SELECT * FROM TranSubLedgerMasterTemp';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // POST a new TranSubLedgerMasterTemp entry
  app.post('/api/entries', (req, res) => {
    const {
      AcCode,
      SubAcCode,
      OpBal,
      TOpBal,
      Debit,
      Credit,
      CurBal,
      DeptCode,
      YearCode,
      UserID,
      SubLedgerGroupCode,
    } = req.body;
    const query = `
      INSERT INTO TranSubLedgerMasterTemp (AcCode, SubAcCode, OpBal, TOpBal, Debit, Credit, CurBal, DeptCode, YearCode, UserID, SubLedgerGroupCode)
      VALUES (
        '${AcCode}',
        '${SubAcCode}',
        '${OpBal}',
        '${TOpBal}',
        '${Debit}',
        '${Credit}',
        '${CurBal}',
        '${DeptCode}',
        '${YearCode}',
        '${UserID}',
        '${SubLedgerGroupCode}'
      );
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'TranSubLedgerMasterTemp entry created successfully' });
      }
    });
  });

  // PUT (update) a TranSubLedgerMasterTemp entry by ID
  app.put('/api/entries/:entryId', (req, res) => {
    const { entryId } = req.params;
    const {
      AcCode,
      SubAcCode,
      OpBal,
      TOpBal,
      Debit,
      Credit,
      CurBal,
      DeptCode,
      YearCode,
      UserID,
      SubLedgerGroupCode,
    } = req.body;
    const query = `
      UPDATE TranSubLedgerMasterTemp
      SET
        AcCode='${AcCode}',
        SubAcCode='${SubAcCode}',
        OpBal='${OpBal}',
        TOpBal='${TOpBal}',
        Debit='${Debit}',
        Credit='${Credit}',
        CurBal='${CurBal}',
        DeptCode='${DeptCode}',
        YearCode='${YearCode}',
        UserID='${UserID}',
        SubLedgerGroupCode='${SubLedgerGroupCode}'
      WHERE AcCode='${entryId}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'TranSubLedgerMasterTemp entry updated successfully',
            AcCode: entryId,
            SubAcCode,
            OpBal,
            TOpBal,
            Debit,
            Credit,
            CurBal,
            DeptCode,
            YearCode,
            UserID,
            SubLedgerGroupCode,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // DELETE a TranSubLedgerMasterTemp entry by ID
  app.delete('/api/entries/:entryId', async (req, res) => {
    const { entryId } = req.params;
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
            const deleteQuery = `DELETE FROM TranSubLedgerMasterTemp WHERE AcCode='${entryId}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'TranSubLedgerMasterTemp entry deleted successfully' });
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
  
  // app.delete('/api/entries/:entryId', (req, res) => {
  //   const { entryId } = req.params;
  //   const query = `DELETE FROM TranSubLedgerMasterTemp WHERE AcCode='${entryId}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'TranSubLedgerMasterTemp entry deleted successfully' });
  //     }
  //   });
  // });

  // For UnitMaster------------------------------------------------------------------------------------

  // GET all units
  app.get('/api/units', (req, res) => {
    const query = 'SELECT * FROM UnitMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // POST a new unit
  app.post('/api/units', (req, res) => {
    const { UnitId, UnitName, DeptCode, YearCode, UserID } = req.body;
    const query = `
      INSERT INTO UnitMaster (UnitId, UnitName, DeptCode, YearCode, UserID)
      VALUES ('${UnitId}', N'${UnitName}', '${DeptCode}', '${YearCode}', N'${UserID}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Unit created successfully' });
      }
    });
  });

  // PUT update an existing unit
  app.put('/api/units/:unitId', (req, res) => {
    const { unitId } = req.params;
    const { UnitName, DeptCode, YearCode, UserID } = req.body;
    const query = `
      UPDATE UnitMaster
      SET UnitName=N'${UnitName}', DeptCode='${DeptCode}', YearCode='${YearCode}', UserID=N'${UserID}'
      WHERE UnitId='${unitId}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'Unit updated successfully',
            UnitId: unitId,
            UnitName,
            DeptCode,
            YearCode,
            UserID,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // DELETE a unit
  app.delete('/api/units/:unitId', async (req, res) => {
    const { unitId } = req.params;
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
            const deleteQuery = `DELETE FROM UnitMaster WHERE UnitId='${unitId}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Unit deleted successfully' });
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
  
  // app.delete('/api/units/:unitId', (req, res) => {
  //   const { unitId } = req.params;
  //   const query = `DELETE FROM UnitMaster WHERE UnitId='${unitId}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'Unit deleted successfully' });
  //     }
  //   });
  // }); 

  //VibhagMasters
  // GET all VibhagMasters
  app.get('/api/vibhags', (req, res) => {
    const query = 'SELECT * FROM VibhagMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // POST a new VibhagMaster
  app.post('/api/vibhags', (req, res) => {
    const {
      VibhagCode,
      VibhagName,
      VibhagAccode,
      VibhagSrNo,
      VibhagFlag,
      Remark1,
      Remark2,
      Remark3,
      USERID,
    } = req.body;
    const query = `
      INSERT INTO VibhagMaster (VibhagCode, VibhagName, VibhagAccode, VibhagSrNo, VibhagFlag, Remark1, Remark2, Remark3, USERID)
      VALUES ('${VibhagCode}', N'${VibhagName}', '${VibhagAccode}', '${VibhagSrNo}', '${VibhagFlag}', N'${Remark1}', N'${Remark2}', N'${Remark3}', N'${USERID}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'VibhagMaster created successfully' });
      }
    });
  });

  // PUT (update) a VibhagMaster by VibhagCode
  app.put('/api/vibhags/:vibhagCode', (req, res) => {
    const { vibhagCode } = req.params;
    const {
      VibhagName,
      VibhagAccode,
      VibhagSrNo,
      VibhagFlag,
      Remark1,
      Remark2,
      Remark3,
      USERID,
    } = req.body;
    const query = `
      UPDATE VibhagMaster
      SET VibhagName=N'${VibhagName}', VibhagAccode='${VibhagAccode}', VibhagSrNo='${VibhagSrNo}', 
          VibhagFlag='${VibhagFlag}', Remark1=N'${Remark1}', Remark2=N'${Remark2}', Remark3=N'${Remark3}', USERID=N'${USERID}'
      WHERE VibhagCode='${vibhagCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'VibhagMaster updated successfully',
            VibhagCode: vibhagCode,
            VibhagName,
            VibhagAccode,
            VibhagSrNo,
            VibhagFlag,
            Remark1,
            Remark2,
            Remark3,
            USERID,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // DELETE a VibhagMaster by VibhagCode
  app.delete('/api/vibhags/:vibhagCode', async (req, res) => {
    const { vibhagCode } = req.params;
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
            const deleteQuery = `DELETE FROM VibhagMaster WHERE VibhagCode='${vibhagCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'VibhagMaster deleted successfully' });
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
  
  // app.delete('/api/vibhags/:vibhagCode', (req, res) => {
  //   const { vibhagCode } = req.params;
  //   const query = `DELETE FROM VibhagMaster WHERE VibhagCode='${vibhagCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'VibhagMaster deleted successfully' });
  //     }
  //   });
  // });


  //villages  ------------------------------------------------------------------------------------
  // GET all villages
  app.get('/api/villages', (req, res) => {
    const query = 'SELECT * FROM VillageMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // POST a new village
  app.post('/api/villages', (req, res) => {
    const {
      VillageCode,
      Village,
      DeptCode,
      YearCode,
      UserID,
      TalukaCode,
    } = req.body;
    const query = `
      INSERT INTO VillageMaster (VillageCode, Village, DeptCode, YearCode, UserID, TalukaCode)
      VALUES ('${VillageCode}', N'${Village}', '${DeptCode}', '${YearCode}', N'${UserID}', '${TalukaCode}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Village created successfully' });
      }
    });
  });

  // PUT (update) a village by ID
  app.put('/api/villages/:villageId', (req, res) => {
    const { villageId } = req.params;
    const {
      Village,
      DeptCode,
      YearCode,
      UserID,
      TalukaCode,
    } = req.body;
    const query = `
      UPDATE VillageMaster
      SET Village=N'${Village}', DeptCode='${DeptCode}', YearCode='${YearCode}', UserID='${UserID}', TalukaCode='${TalukaCode}'
      WHERE VillageCode='${villageId}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'Village updated successfully',
            VillageCode: villageId,
            Village,
            DeptCode,
            YearCode,
            UserID,
            TalukaCode,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // DELETE a village by ID
  app.delete('/api/villages/:villageId', async (req, res) => {
    const { villageId } = req.params;
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
            const deleteQuery = `DELETE FROM VillageMaster WHERE VillageCode='${villageId}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Village deleted successfully' });
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
  
  // app.delete('/api/villages/:villageId', (req, res) => {
  //   const { villageId } = req.params;
  //   const query = `DELETE FROM VillageMaster WHERE VillageCode='${villageId}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'Village deleted successfully' });
  //     }
  //   });
  // });


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

  app.post('/api/year_master' , (req,res)=>{
    const {YearCode, StartYear , EndYear , FinancialYear , DeptCode , CompCode } = req.body
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

  app.put('/api/year_master/:YearCode', (req,res)=>{
    const {YearCode} = req.params;
    const {StartYear , EndYear , FinancialYear , DeptCode , CompCode } = req.body
    const query = `UPDATE YearMaster SET StartYear='${StartYear}', EndYear='${EndYear}', FinancialYear=N'${FinancialYear}', DeptCode=N'${DeptCode}', CompCode=N'${CompCode}' WHERE YearCode='${YearCode}'`;
    sql.query(query , (err)=>{
        if(err){
            console.log('error:',err);
            res.status(500).json({error:'internal server error'});
        }else{
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


  // For CompanyMaster  ------------------------------------------------------------------------------------

  app.get('/api/company', (req, res) => {
    const query = 'SELECT * FROM CompanyMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  app.post('/api/company' , (req,res)=>{
    const {CompCode, CompName , CompAddress , CompAddress1 , CompAddress2 , CompCity , CompStateCode , CompGSTIN , CompPhone , CompEmail , Fax , WebSite , CompNarr1 , CompNarr2 } = req.body
    const query =  `INSERT INTO CompanyMaster (CompCode, CompName , CompAddress , CompAddress1 , CompAddress2 ,  CompCity , CompStateCode , CompGSTIN , CompPhone , CompEmail , Fax , WebSite , CompNarr1 , CompNarr2 ) VALUES ('${CompCode}',N'${CompName}',N'${CompAddress}',N'${CompAddress1}', N'${CompAddress2}' ,  N'${CompCity}' , N'${CompStateCode}',N'${CompGSTIN}',N'${CompPhone}',N'${CompEmail}',N'${Fax}', N'${WebSite}',N'${CompNarr1}',N'${CompNarr2}' )`;
    sql.query(query, (err) => {
        if (err) {
          console.log('Error:', err);
          res.status(500).json({ error: 'Internal server error' });
        } else {
          res.json({ message: 'Company created successfully' });
        }
      });
  });


  app.put('/api/company/:CompCode', (req,res)=>{
    const {CompCode} = req.params;
    const {CompName , CompAddress , CompAddress1 , CompAddress2 , CompCity , CompStateCode , CompGSTIN , CompPhone , CompEmail , Fax , WebSite , CompNarr1 , CompNarr2 } = req.body
    const query = `UPDATE CompanyMaster SET CompName=N'${CompName}', CompAddress=N'${CompAddress}', CompAddress1=N'${CompAddress1}', CompAddress2=N'${CompAddress2}', CompCity=N'${CompCity}', CompStateCode='${CompStateCode}', CompGSTIN='${CompGSTIN}', CompPhone='${CompPhone}', CompEmail='${CompEmail}', Fax='${Fax}', WebSite='${WebSite}', CompNarr1='${CompNarr1}', CompNarr2='${CompNarr2}' WHERE CompCode='${CompCode}';`;
    sql.query(query , (err)=>{
        if(err){
            console.log('error:',err);
            res.status(500).json({error:'internal server error'});
        }else{
            res.json({ message: 'Company created successfully' });
        }
    });
  });

  app.delete('/api/company/:CompCode', async (req, res) => {
    const { CompCode } = req.params;
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
            const deleteQuery = `DELETE FROM CompanyMaster WHERE CompCode=${CompCode}`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Company deleted successfully' });
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

  // app.delete('/api/company/:CompCode', (req,res)=>{
  //   const { CompCode } = req.params;
  //   //console.log("Comp Code  ",CompCode);
  //   const query = `DELETE FROM CompanyMaster WHERE CompCode=${CompCode}`;
  //   sql.query(query,(err) => {
  //       if (err) {
  //         console.log('Error:', err);
  //         res.status(500).json({ error: 'Internal server error' });
  //       } else {
  //         res.json({ message: 'Company deleted successfully' });
  //       }
  //     });
  // });


  // TranEntry API    ------------------------------------------------------------------------------------

  app.get('/api/distinct-tranentries/:flag/:dept/:year/:company', (req, res) => {
    const flag = req.params.flag;
    const dept = req.params.dept;
    const year = req.params.year;
    const company = req.params.company;

    const query = `
      SELECT distinct EntryNo, TrDate, Flag
      FROM TranEntry
      WHERE Flag = @flag
        AND DeptCode = @dept
        AND YearCode = @year
        AND CompCode = @company`;

    const request = new sql.Request();
    request.input('flag', sql.NVarChar, flag);
    request.input('dept', sql.NVarChar, dept);
    request.input('year', sql.NVarChar, year);
    request.input('company', sql.NVarChar, company);

    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  app.get('/api/tranentries/:entryNo/:flag', (req, res) => {
    const entryNo = req.params.entryNo; // Get the entry number from the URL
    const flag = req.params.flag; // Get the "flag" from the URL parameters

    // Modify the query to select a specific entry number and consider the "flag"
    const query = `
      SELECT *
      FROM TranEntry
      WHERE EntryNo = @entryNo AND Flag = @flag`; // Use parameterized query to avoid SQL injection

    const request = new sql.Request();
    request.input('entryNo', sql.NVarChar, entryNo); // Define the SQL parameter for "entryNo"
    request.input('flag', sql.NVarChar, flag); // Define the SQL parameter for "flag"

    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  app.get('/api/tranNewEntries', (req, res) => {
    const { UserId} = req.query;
    const query = `select * from TranEntryTempSub WHERE UserId=${UserId}`;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  })

  app.post('/api/Savetranentries', async (req, res) => {
    const { flag,DeptCode,YearCode,CompCode, entryNo,operation} = req.body; 
    // Get the latest max entry number for the given flag
    const getMaxEntryNoQuery = `
      SELECT MAX(CAST(EntryNo AS INT)) AS MaxEntryNo
      FROM TranEntry
      WHERE Flag = '${flag}'AND DeptCode = ${DeptCode} AND YearCode = ${YearCode} AND CompCode = ${CompCode}`;
      console.log("getMaxEntryNoQuery",getMaxEntryNoQuery);
      const maxEntryNoResult = await sql.query(getMaxEntryNoQuery);
      const maxEntryNo = maxEntryNoResult.recordset[0]?.MaxEntryNo || 1;
      console.log("maxEntryNo",maxEntryNo);
      console.log("maxEntryNo",maxEntryNo + 1);


    // SQL query to insert data into TranEntry and delete from TranEntryTempSub
    const query = `
      DELETE TE
      FROM TranEntry AS TE
      WHERE TE.EntryNo = ${operation === 'update' ? entryNo : maxEntryNo + 1} AND TE.Flag = '${flag}' AND TE.DeptCode = '${DeptCode}' AND TE.YearCode = '${YearCode}'  AND TE.CompCode = '${CompCode}';

      INSERT INTO TranEntry (EntryNo, TrDate, Flag, AcCode, SubLedgerGroupCode, SubAcCode, CrAmt, DrAmt, DeptCode, YearCode, CompCode, UserID,COMPUTERID)
      SELECT ${operation === 'update' ? entryNo : maxEntryNo + 1}, TrDate, Flag, AcCode, SubLedgerGroupCode, SubAcCode, CrAmt, DrAmt , DeptCode, YearCode, CompCode, UserID, COMPUTERID FROM TranEntryTempSub;

      DELETE TETS
      FROM TranEntryTempSub AS TETS
      WHERE TETS.EntryNo = ${operation === 'update' ? entryNo : maxEntryNo + 1} AND TETS.Flag = '${flag}'AND TETS.DeptCode = '${DeptCode}' AND TETS.YearCode = '${YearCode}'  AND TETS.CompCode = '${CompCode}';
      `;

    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Data saved and deleted successfully' });
      }
    });
  });

  app.post('/api/tranentriesPost', (req, res) => {
    const {
      entryNo,
      trDate,
      acCode,
      subLedgerGroupCode,
      subAcCode,
      crAmt,
      drAmt,
      chqNo,
      narration1,
      DeptCode,
      YearCode,
      CompCode,
      UserID,
      flag,
      uniqueCode
    } = req.body;

    let query = `
      INSERT INTO TranEntryTempSub (EntryNo, TrDate, Flag, AcCode, SubLedgerGroupCode, SubAcCode, CrAmt, DrAmt, DeptCode, YearCode, CompCode, UserID , COMPUTERID`;

    // Conditionally add chqNo to the SQL query if it's provided
    if (chqNo) {
      query += ', ChqNo';
    }

    // Conditionally add narration1 to the SQL query if it's provided
    if (narration1) {
      query += ', Narration1';
    }

    query += `)
      VALUES ('${entryNo}', '${trDate}', '${flag}', '${acCode}', '${subLedgerGroupCode}', '${subAcCode}', '${crAmt}', '${drAmt}',${DeptCode},${YearCode},${CompCode},${UserID},${uniqueCode}`;

    // Conditionally add the values for chqNo and narration1
    if (chqNo) {
      query += `, '${chqNo}'`;
    }

    if (narration1) {
      query += `, '${narration1}'`;
    }

    query += ');';

    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Data saved successfully' });
      }
    });
  });

  app.put('/api/tranentries/:uniqueCode', (req, res) => {
    const { uniqueCode } = req.params;
    const {
      TrDate,
      Flag,
      AcCode,
      SubLedgerGroupCode,
      SubAcCode,
      CrAmt,
      DrAmt,
      ChqNo,
      Narration1,
      Narration2,
      Narration3,
      DeptCode,
      YearCode,
      CompCode,
      UserID
    } = req.body;
    const query = `
      UPDATE TranEntry
      SET TrDate='${TrDate}', Flag='${Flag}', AcCode='${AcCode}', SubLedgerGroupCode='${SubLedgerGroupCode}', SubAcCode='${SubAcCode}', CrAmt='${CrAmt}', DrAmt='${DrAmt}', ChqNo='${ChqNo}', Narration1=N'${Narration1}', Narration2=N'${Narration2}', Narration3=N'${Narration3}',
      DeptCode=${DeptCode},YearCode=${YearCode} ,CompCode=${CompCode} ,UserID=${UserID} WHERE COMPUTERID='${uniqueCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'TranEntry updated successfully',
            EntryNo: entryNo,
            TrDate,
            Flag,
            AcCode,
            SubLedgerGroupCode,
            SubAcCode,
            CrAmt,
            DrAmt,
            ChqNo,
            Narration1,
            Narration2,
            Narration3,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });


  app.put('/api/Newtranentries/:uniqueCode/:UserID', (req, res) => {
    const { uniqueCode , UserID } = req.params;
    const {
      entryNo,
      trDate,
      flag,
      acCode,
      subLedgerGroupCode,
      subAcCode,
      crAmt,
      drAmt,
      chqNo,
      narration1,
      narration2,
      narration3,
    } = req.body;

    // Check if the ID exists in TranEntry
    const queryCheckTranEntry = `SELECT COUNT(*) AS count FROM TranEntry WHERE COMPUTERID=${uniqueCode} AND UserID=${UserID}`;
    sql.query(queryCheckTranEntry, (err) => {
      if (err) {
        console.log('Error checking TranEntry:', err);
        return res.status(500).json({ error: 'Internal server error for TranEntry check' });
      }
       const updateQuery = `
          UPDATE TranEntryTempSub
          SET TrDate='${trDate}', Flag='${flag}', AcCode='${acCode}', SubLedgerGroupCode='${subLedgerGroupCode}', SubAcCode='${subAcCode}', CrAmt='${crAmt}', DrAmt='${drAmt}'${chqNo ? `, ChqNo='${chqNo}'` : ''}${narration1 ? `, Narration1='${narration1}'` : ''} WHERE COMPUTERID=${uniqueCode};`;
      // Execute the update query
      sql.query(updateQuery, (err, result) => {
        if (err) {
          console.log('Error updating:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        const rowsAffected = result.rowsAffected && result.rowsAffected[0];

        if (rowsAffected > 0) {
          return res.json({
            message: 'Record updated successfully',
            entryNo,
            trDate,
            flag,
            acCode,
            subLedgerGroupCode,
            subAcCode,
            crAmt,
            drAmt,
            chqNo,
            narration1,
            narration2,
            narration3,
          });
        } else {
          return res.status(404).json({ error: 'Record not found for the specified ID', uniqueCode });
        }
      });
    });
  });

  app.delete('/api/tranentries/:entryNo/:flag', async (req, res) => {
    const { entryNo, flag } = req.params;
    const UserName = req.headers['username'];
  
    try {
      // Fetch user permissions from the database based on the user making the request
      const userPermissionsQuery = `SELECT AllowEntryDelete FROM Users WHERE UserName='${UserName}'`;
  
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
            const deleteQuery = `DELETE FROM TranEntry WHERE EntryNo='${entryNo}' AND Flag='${flag}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'TranEntry deleted successfully' });
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
  
  // app.delete('/api/tranentries/:entryNo/:flag', (req, res) => {
  //   const { entryNo, flag } = req.params;
  //   const query = `DELETE FROM TranEntry WHERE EntryNo='${entryNo}' AND Flag='${flag}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'TranEntry deleted successfully' });
  //     }
  //   });
  // });

  app.delete('/api/Newtranentries/:uniqueCode/:UserID', async (req, res) => {
    const { uniqueCode, UserID } = req.params;
    const UserName = req.headers['username'];
  
    try {
      // Fetch user permissions from the database based on the user making the request
      const userPermissionsQuery = `SELECT AllowEntryDelete FROM Users WHERE UserName='${UserName}'`;
  
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
            const deleteQuery = `DELETE FROM TranEntryTempSub WHERE COMPUTERID='${uniqueCode}' AND UserID='${UserID}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'BillSubTemp deleted successfully' });
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
  

  // app.delete('/api/Newtranentries/:uniqueCode/:UserID', (req, res) => {
  //   const { uniqueCode , UserID} = req.params;
  //   const query = `DELETE FROM TranEntryTempSub WHERE COMPUTERID=${uniqueCode} AND UserID=${UserID}`;
  //   console.log("print",uniqueCode);
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'BillSubTemp deleted successfully' });
  //     }
  //   });
  // });

  
  app.post('/api/tranEntry-insertDataAndFlag', (req, res) => {
    const entryNo = req.body.entryNo;
    const flag = req.body.flag;

    const query = `
      DELETE FROM TranEntryTempSub;

      
      INSERT INTO TranEntryTempSub (EntryNo, TrDate, Flag, AcCode, SubLedgerGroupCode, SubAcCode, CrAmt, DrAmt, DeptCode, YearCode, CompCode, UserID,COMPUTERID)
      SELECT EntryNo, TrDate, Flag, AcCode, SubLedgerGroupCode, SubAcCode, CrAmt, DrAmt, DeptCode, YearCode, CompCode, UserID,COMPUTERID
      FROM TranEntry
      WHERE EntryNo = @entryNo AND Flag = @flag;
    `;

    const request = new sql.Request();
    request.input('entryNo', sql.Int, entryNo);
    request.input('flag', sql.VarChar(255), flag);

    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Data saved successfully' });
      }
    });
  });

  app.delete('/api/cleartranEntryTemp', (req, res) => {
    const entryNo = req.body.entryNo;
    const flag = req.body.flag;
    const UserID = req.body.UserID; // Fix: Use req.body.UserID
  
    const query = `
      DELETE FROM TranEntryTempSub WHERE UserID=${UserID};
    `;
  
    const request = new sql.Request();
    request.input('UserID', sql.Int, UserID);
  
    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Data saved successfully' });
      }
    });
  });
  

 //Billsub Entry ------------------------------------------------------------------------------------

  app.post('/api/SaveBillentries', async (req, res) => {
    const { flag,DeptCode,YearCode,CompCode,trDate, AcCode, BillNo, BillDate, Desc1, Desc2,operation, entryNo,RoundOff,TotNetAmt, TotIGST,TotCGST,TotSGST,GrossTotAmt,UserID} = req.body; 
    // Get the latest max entry number for the given flag
    const getMaxEntryNoQuery = `
      SELECT MAX(ENTRYNO) AS MaxEntryNo
      FROM Billsub
      WHERE Flag = '${flag}'AND DeptCode = '${DeptCode}'AND YearCode = '${YearCode}' AND CompCode = '${CompCode}'`;
    console.log("getMaxEntryNoQuery",getMaxEntryNoQuery);
    const maxEntryNoResult = await sql.query(getMaxEntryNoQuery);
    const maxEntryNo = maxEntryNoResult.recordset[0]?.MaxEntryNo || 0;
    console.log("maxEntryNo",maxEntryNo);

    // SQL query to insert data into TranEntry and delete from TranEntryTempSub
    let  query = `
      DELETE TE
      FROM Billsub AS TE
      WHERE TE.EntryNo = '${operation === 'update' ? entryNo : maxEntryNo + 1}' AND TE.Flag = '${flag}' AND TE.DeptCode = '${DeptCode}' AND TE.YearCode = '${YearCode}'  AND TE.CompCode = '${CompCode}';

      INSERT INTO Billsub (TRDATE, Flag, AcCode, ItCode, BillNo, BillDate, Desc1, Desc2, MRP, Qty, Rate, Amount, DiscAmt, TaxableAmt, GstRateCode, GstRate, CGstAmt, SGstAmt, IGstAmt, RoundOff, NetAmt, ENTRYNO, YearCode, DeptCode, CompCode, USERID, COMPUTERID)
      SELECT  
      '${trDate}',Flag,'${AcCode}',ItCode,'${BillNo}','${BillDate}','${Desc1}','${Desc2}', MRP,Qty,Rate,Amount,DiscAmt,TaxableAmt,GstRateCode,GstRate,CGstAmt,SGstAmt,IGstAmt,RoundOff,
       NetAmt,'${operation === 'update' ? entryNo : maxEntryNo + 1}', YearCode,DeptCode,CompCode,USERID,COMPUTERID
      FROM BillsubTemp;

      DELETE TETS
      FROM BillsubTemp AS TETS
      WHERE TETS.EntryNo = '${operation === 'update' ? entryNo : maxEntryNo + 1}' AND TETS.Flag = '${flag}'AND TETS.DeptCode = '${DeptCode}' AND TETS.YearCode = '${YearCode}'  AND TETS.CompCode = '${CompCode}';
      
      delete from billentry where EntryNo = '${operation === 'update' ? entryNo : maxEntryNo + 1}' AND Flag = '${flag}' AND DeptCode = '${DeptCode}' AND YearCode = '${YearCode}'  AND CompCode = '${CompCode}';
        INSERT INTO BillEntry (CompCode, Deptcode, YearCode, UserId, flag, entryno, trdate, accode, subaccode, billno, billdate, TaxableAmt, CgstAmt, SgstAmt, IgstAmt, RoundOff, NetAmt)
        VALUES ('${CompCode}', '${DeptCode}', '${YearCode}', '${UserID}', '${flag}', '${operation === 'update' ? entryNo : maxEntryNo + 1}', '${trDate}', '${AcCode}', '${AcCode}', '${BillNo}',' ${BillDate}', '${GrossTotAmt}','${TotCGST}', '${TotSGST}','${TotIGST}','${RoundOff}', '${TotNetAmt}');`   
        if (flag === 'S'|| flag === 'PR' ) {
          // Additional code to run when flag is 'P' or 'S'
          query += `
          DELETE FROM Tranentry 
          WHERE EntryNo = '${operation === 'update' ? entryNo : maxEntryNo + 1}' AND Flag = '${flag}' AND DeptCode = '${DeptCode}' AND YearCode = '${YearCode}' AND CompCode = '${CompCode}';
    
          INSERT INTO Tranentry (CompCode, Deptcode, YearCode, UserId, flag, entryno, trdate, accode, subaccode, DrAmt,CrAmt)
          VALUES ('${CompCode}', '${DeptCode}', '${YearCode}', '${UserID}', '${flag}', '${operation === 'update' ? entryNo : maxEntryNo + 1}', '${trDate}','${AcCode}', '${AcCode}','${TotNetAmt}',0);
    
    
          INSERT INTO Tranentry (CompCode, Deptcode, YearCode, UserId, flag, entryno, trdate, accode, subaccode, CrAmt,DrAmt)
          VALUES ('${CompCode}','${DeptCode}', '${YearCode}', '${UserID}', '${flag}','${operation === 'update' ? entryNo : maxEntryNo + 1}','${trDate}', 4,0,'${GrossTotAmt}',0);
    
    
          INSERT INTO Tranentry (CompCode, Deptcode, YearCode, UserId, flag, entryno, trdate, accode, subaccode, CrAmt,DrAmt)
          VALUES ('${CompCode}','${DeptCode}', '${YearCode}', '${UserID}', '${flag}','${operation === 'update' ? entryNo : maxEntryNo + 1}','${trDate}', 7,0,'${TotCGST}',0);
    
    
          INSERT INTO Tranentry (CompCode, Deptcode, YearCode, UserId, flag, entryno, trdate, accode, subaccode, CrAmt,DrAmt)
          VALUES ('${CompCode}','${DeptCode}', '${YearCode}', '${UserID}', '${flag}','${operation === 'update' ? entryNo : maxEntryNo + 1}','${trDate}', 8,0,'${TotSGST}',0);
    
    
          INSERT INTO Tranentry (CompCode, Deptcode, YearCode, UserId, flag, entryno, trdate, accode, subaccode, CrAmt,DrAmt)
          VALUES ('${CompCode}','${DeptCode}', '${YearCode}', '${UserID}', '${flag}','${operation === 'update' ? entryNo : maxEntryNo + 1}','${trDate}', 9,0,'${TotIGST}',0);
          
          INSERT INTO Tranentry (CompCode, Deptcode, YearCode, UserId, flag, entryno, trdate, accode, subaccode, DrAmt, CrAmt)
          VALUES ('${CompCode}','${DeptCode}', '${YearCode}', '${UserID}', '${flag}','${operation === 'update' ? entryNo : maxEntryNo + 1}','${trDate}', 12,0,'${RoundOff < 0 ? -RoundOff : 0}','${RoundOff > 0 ? RoundOff : 0}');
          `;
          }
          if (flag === 'P' || flag === 'SR' ) {
            // Additional code to run when flag is 'P' or 'S'
            query += `
            DELETE FROM Tranentry 
            WHERE EntryNo = '${operation === 'update' ? entryNo : maxEntryNo + 1}' AND Flag = '${flag}' AND DeptCode = '${DeptCode}' AND YearCode = '${YearCode}' AND CompCode = '${CompCode}';
            
            INSERT INTO Tranentry (CompCode, Deptcode, YearCode, UserId, flag, entryno, trdate, accode, subaccode, CrAmt,DrAmt)
            VALUES ('${CompCode}', '${DeptCode}', '${YearCode}', '${UserID}', '${flag}', '${operation === 'update' ? entryNo : maxEntryNo + 1}', '${trDate}', '${AcCode}','${AcCode}','${TotNetAmt}',0);
        
            
            INSERT INTO Tranentry (CompCode, Deptcode, YearCode, UserId, flag, entryno, trdate, accode, subaccode, DrAmt,CrAmt)
            VALUES ('${CompCode}','${DeptCode}', '${YearCode}', '${UserID}', '${flag}','${operation === 'update' ? entryNo : maxEntryNo + 1}','${trDate}', 3,0,'${GrossTotAmt}',0);
        
            
            INSERT INTO Tranentry (CompCode, Deptcode, YearCode, UserId, flag, entryno, trdate, accode, subaccode, DrAmt,CrAmt)
            VALUES ('${CompCode}','${DeptCode}', '${YearCode}', '${UserID}', '${flag}','${operation === 'update' ? entryNo : maxEntryNo + 1}','${trDate}', 7,0,'${TotCGST}',0);
        
            
            INSERT INTO Tranentry (CompCode, Deptcode, YearCode, UserId, flag, entryno, trdate, accode, subaccode, DrAmt,CrAmt)
            VALUES ('${CompCode}','${DeptCode}', '${YearCode}', '${UserID}', '${flag}','${operation === 'update' ? entryNo : maxEntryNo + 1}','${trDate}', 8,0,'${TotSGST}',0);
        
            
            INSERT INTO Tranentry (CompCode, Deptcode, YearCode, UserId, flag, entryno, trdate, accode, subaccode, DrAmt,CrAmt)
            VALUES ('${CompCode}','${DeptCode}', '${YearCode}', '${UserID}', '${flag}','${operation === 'update' ? entryNo : maxEntryNo + 1}','${trDate}', 9,0,'${TotIGST}',0);
        
            
            INSERT INTO Tranentry (CompCode, Deptcode, YearCode, UserId, flag, entryno, trdate, accode, subaccode, CrAmt, DrAmt)
            VALUES ('${CompCode}','${DeptCode}', '${YearCode}', '${UserID}', '${flag}','${operation === 'update' ? entryNo : maxEntryNo + 1}','${trDate}', 12,0,'${RoundOff < 0 ? -RoundOff : 0}','${RoundOff > 0 ? RoundOff : 0}');
            `;
            }     
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Data saved and deleted successfully'});
      }
    });
  });

  app.delete('/api/NewSelltries/:entryNo/:flag', async (req, res) => {
    const { entryNo, flag } = req.params;
    const UserName = req.headers['username'];
  
    try {
      // Fetch user permissions from the database based on the user making the request
      const userPermissionsQuery = `SELECT AllowEntryDelete FROM dbo.Users WHERE UserName='${UserName}'`;
  
      sql.query(userPermissionsQuery, async (userErr, userResults) => {
        if (userErr) {
          console.log('Error fetching user permissions:', userErr);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
  
        // Check if user results are not empty
        if (userResults.recordset && userResults.recordset.length > 0) {
          // Check if user has permission to delete entries
          const { AllowEntryDelete } = userResults.recordset[0];
  
          if (AllowEntryDelete === 1) {
            // The user has permission to delete entries
            const deleteQuery = `
              DELETE FROM BillSub  WHERE EntryNo='${entryNo}' AND Flag='${flag}';
              DELETE FROM BillEntry  WHERE EntryNo='${entryNo}' AND Flag='${flag}';
              DELETE FROM TranEntry  WHERE EntryNo='${entryNo}' AND Flag='${flag}';
            `;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Entries deleted successfully' });
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
  

  // app.delete('/api/NewSelltries/:entryNo/:flag', (req, res) => {
  //   const { entryNo, flag } = req.params;
  //   const query = `DELETE FROM BillSub  WHERE EntryNo='${entryNo}' AND Flag='${flag}';
  //                   DELETE FROM BillEntry  WHERE EntryNo='${entryNo}' AND Flag='${flag}';
  //                   DELETE FROM TranEntry  WHERE EntryNo='${entryNo}' AND Flag='${flag}';`;

  //   console.log("print",entryNo, flag);
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'BillSubTemp deleted successfully' });
  //     }
  //   });
  // });

  app.get('/api/distinct-sellentries/:flag/:dept/:year/:company', (req, res) => {
    const flag = req.params.flag;
    const dept = req.params.dept;
    const year = req.params.year;
    const company = req.params.company;
    // Validate inputs and handle potential security concerns


        const query = `
      SELECT distinct ENTRYNO, BILLNO, TRDATE,FLAG,CompCode, BILLDATE ,ACCODE,DESC1,DESC2,NETAMT
      FROM Billsub
      WHERE Flag = @flag
        AND DeptCode = @dept
        AND YearCode = @year
        AND CompCode = @company;`;

    const request = new sql.Request();
    request.input('flag', sql.NVarChar, flag);
    request.input('dept', sql.NVarChar, dept);
    request.input('year', sql.NVarChar, year);
    request.input('company', sql.NVarChar, company);

    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  app.get('/api/billsubtemp/:flag', (req, res) => {
    const flag = req.params.flag; // Get the "flag" from the URL parameters


    // Modify the query to select a specific entry number and consider the "flag"
    const query = `
      SELECT *
      FROM BillsubTemp
      WHERE FLAG = @flag`; // Use parameterized query to avoid SQL injection

    const request = new sql.Request();
    request.input('flag', sql.NVarChar, flag); // Define the SQL parameter for "flag"

    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  app.get('/api/sellentries/:entryNo/:flag', (req, res) => {
    const entryNo = req.params.entryNo; // Get the entry number from the URL
    const flag = req.params.flag; // Get the "flag" from the URL parameters

    // Modify the query to select a specific entry number and consider the "flag"
    const query = `
      SELECT *
      FROM Billsub
      WHERE ENTRYNO = @entryNo AND FLAG = @flag`; // Use parameterized query to avoid SQL injection

    const request = new sql.Request();
    request.input('entryNo', sql.NVarChar, entryNo); // Define the SQL parameter for "entryNo"
    request.input('flag', sql.NVarChar, flag); // Define the SQL parameter for "flag"

    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  app.post('/api/sellentriesPost', (req, res) => {
    const {
        flag,
        entryNo,
        trDate,
        AcCode,
        ItCode,
        BillNo,
        BillDate,
        Desc1,
        Desc2,
        MRP,
        Qty,
        Rate,
        Amount,
        DiscAmt,
        TaxableAmt,
        GstRateCode,
        GstRate,
        CGstAmt,
        SGstAmt,
        IGstAmt,
        RoundOff,
        NetAmt,
        DeptCode,
        YearCode,
        CompCode,
        USERID,
        uniqueCode
    } = req.body;


    let query = `
      INSERT INTO BillsubTemp (flag, EntryNo, TrDate, AcCode, ItCode, BillNo, BillDate, Desc1, Desc2,  MRP, Qty, Rate, Amount, DiscAmt, TaxableAmt, GSTRateCode, GstRate, CGSTAmt, SGSTAmt, IGSTAmt, RoundOff, NetAmt, DeptCode, YearCode, CompCode, USERID, COMPUTERID) 
      VALUES ('${flag}','${entryNo}', '${trDate}', ${AcCode}, '${ItCode}','${BillNo}','${BillDate}','${Desc1}','${Desc2}',  '${MRP}', '${Qty}', '${Rate}', '${Amount}', '${DiscAmt}', '${TaxableAmt}', '${GstRateCode}','${GstRate}', '${CGstAmt}', '${SGstAmt}', '${IGstAmt}', '${RoundOff}','${NetAmt}','${DeptCode}','${YearCode}',${CompCode},${USERID},${uniqueCode})`;

    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Data saved successfully' });
      }
    });
  });

  app.post('/api/insertDataAndFlag', (req, res) => {
    const entryNo = req.body.entryNo;
    const flag = req.body.flag;
    const DeptCode = req.body.DeptCode;
    const YearCode = req.body.YearCode;
    const CompCode = req.body.CompCode;
    
    const query = `
      DELETE FROM BillsubTemp;

      INSERT INTO BillsubTemp (flag, EntryNo, TrDate, AcCode, ItCode, BillNo, BillDate, Desc1, Desc2,  MRP, Qty, Rate, Amount, DiscAmt, TaxableAmt, GSTRateCode, GstRate, CGSTAmt, SGSTAmt, IGSTAmt, RoundOff, NetAmt, DeptCode ,YearCode, USERID ,CompCode,COMPUTERID)
      SELECT flag, EntryNo, TrDate, AcCode, ItCode, BillNo, BillDate, Desc1, Desc2,  MRP, Qty, Rate, Amount, DiscAmt, TaxableAmt, GSTRateCode, GstRate, CGSTAmt, SGSTAmt, IGSTAmt, RoundOff, NetAmt, DeptCode , YearCode ,USERID ,CompCode,COMPUTERID
      FROM Billsub
      WHERE EntryNo = @entryNo AND Flag = @flag  AND DeptCode = @DeptCode  AND YearCode = @YearCode  AND CompCode = @CompCode;
    `;

    const request = new sql.Request();
    request.input('entryNo', sql.Int, entryNo);
    request.input('flag', sql.VarChar(255), flag);
    request.input('DeptCode', sql.Int, DeptCode);
    request.input('YearCode', sql.Int, YearCode);
    request.input('CompCode', sql.Int, CompCode);

    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Data saved successfully' });
      }
    });
  });

  app.put('/api/NewSaleEntries/:entryNo/:uniqueCode/:flag', (req, res) => {
    const { entryNo , flag , uniqueCode} = req.params;
    const {
        trDate,
        AcCode,
        ItCode,
        BillNo,
        BillDate,
        Desc1,
        Desc2,
        MRP,
        Qty,
        Rate,
        Amount,
        DiscAmt,
        TaxableAmt,
        GstRateCode,
        GstRate,
        CGstAmt,
        SGstAmt,
        IGstAmt,
        RoundOff,
        NetAmt,
        DeptCode
    } = req.body;

    // Always update TranEntryTempSub
    const updateQuery = `
      UPDATE BillSubTemp
      SET TrDate='${trDate}', AcCode='${AcCode}', ItCode='${ItCode}',BillNo='${BillNo}',BillDate='${BillDate}',Desc1='${Desc1}',Desc2='${Desc2}', MRP='${MRP}', Qty='${Qty}', Rate='${Rate}', Amount='${Amount}', DiscAmt='${DiscAmt}', TaxableAmt='${TaxableAmt}', GstRateCode='${GstRateCode}',GstRate='${GstRate}', CGstAmt='${CGstAmt}', SGstAmt='${SGstAmt}', IGstAmt='${IGstAmt}',RoundOff='${RoundOff}', NetAmt='${NetAmt}'  WHERE ENTRYNO=${entryNo} AND COMPUTERID=${uniqueCode} AND Flag='${flag}' ;`;

    // Execute the update query
    sql.query(updateQuery, (err, result) => {
      if (err) {
        console.log('Error updating:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      const rowsAffected = result.rowsAffected && result.rowsAffected[0];

      if (rowsAffected > 0) {
        return res.json({
          message: 'Record updated successfully',
          entryNo,
          trDate,
          AcCode,
          ItCode,
          BillNo,
          BillDate,
          Desc1,
          Desc2,
          MRP,
          Qty,
          Rate,
          Amount,
          DiscAmt,
          TaxableAmt,
          GstRateCode,
          GstRate,
          CGstAmt,
          SGstAmt,
          IGstAmt,
          RoundOff,
          NetAmt,
          DeptCode
        });
      } else {
        return res.status(404).json({ error: 'Record not found for the specified ID', entryNo , uniqueCode , flag });
      }
    });
  });

  app.delete('/api/billsubtempentries/:entryNo/:YearCode', (req, res) => {
    const { entryNo, YearCode } = req.params;
    const query = `DELETE FROM BillSubTemp WHERE EntryNo=${entryNo} AND YearCode=${YearCode}`;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'BillSubTemp deleted successfully' });
      }
    });
  });

  app.delete('/api/clearTemp', (req, res) => {
    const query = `DELETE FROM BillSubTemp`;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'BillSubTemp deleted successfully' });
      }
    });
  });


  //report of jasper ------------------------------------------------------------------------------------

  app.get('/api/report/:paramCode', async (req, res) => {
    const url = "http://localhost:8080/jasperserver/rest_v2/reports/reports/Customer.pdf";
    const paramCode = req.params.paramCode;
    const params = {
      ParamCode: paramCode
    };

    try {
      const file = await axios.get(url, {
        params: params,
        responseType: "stream",
        auth: {
          username: "jasperadmin",
          password: "jasperadmin"
        }
      });

      // Set the appropriate headers, including character encoding
      res.setHeader('Content-Type', 'application/pdf; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename=report.pdf');

      file.data.pipe(res);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // For CasteMaster------------------------------------------------------------------------------------

  // GET all caste
  app.get('/api/caste', (req, res) => {
    const query = 'SELECT * FROM CasteMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // POST a new caste
  app.post('/api/caste', (req, res) => {
    const { CasteCode, CasteName, UserID } = req.body;
    const query = `
      INSERT INTO CasteMaster (CasteCode, Caste, UserID)
      VALUES ('${CasteCode}', N'${CasteName}',  N'${UserID}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Caste created successfully' });
      }
    });
  });

  // PUT update an existing caste
  app.put('/api/caste/:CasteCode', (req, res) => {
    const { CasteCode } = req.params;
    const { CasteName, UserID } = req.body;
    const query = `
      UPDATE CasteMaster
      SET Caste=N'${CasteName}', UserID=N'${UserID}'
      WHERE CasteCode='${CasteCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'Caste updated successfully',
            CasteCode: CasteCode,
            CasteName,
            UserID,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // DELETE a caste
  app.delete('/api/caste/:casteCode', async (req, res) => {
    const { casteCode } = req.params;
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
            const deleteQuery = `DELETE FROM CasteMaster WHERE CasteCode='${casteCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Caste deleted successfully' });
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
  
  // app.delete('/api/caste/:casteCode', (req, res) => {
  //   const { casteCode } = req.params;
  //   const query = `DELETE FROM CasteMaster WHERE CasteCode='${casteCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'Caste deleted successfully' });
  //     }
  //   });
  // }); 

  // For Qualification Master------------------------------------------------------------------------------------

  // GET all Qual
  app.get('/api/qual', (req, res) => {
    const query = 'SELECT * FROM QualificationMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // POST a new Qual
  app.post('/api/qual', (req, res) => {
    const { QualificationCode, QualificationName, UserID } = req.body;

    const query = `
      INSERT INTO QualificationMaster (QualificationCode, Qualification, Userid)
      VALUES ('${QualificationCode}', N'${QualificationName}',  N'${UserID}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Qualification created successfully' });
      }
    });
  });

  // PUT update an existing Qual
  app.put('/api/qual/:qualificationCode', (req, res) => {
    const { qualificationCode } = req.params;

    const { qualificationName, UserID } = req.body;

    const query = `
      UPDATE QualificationMaster
      SET Qualification=N'${qualificationName}', Userid=N'${UserID}'
      WHERE QualificationCode=${qualificationCode};
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'Qualification updated successfully',
            QualificationCode: qualificationCode,
            qualificationName,
            UserID,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // DELETE a Qual
  app.delete('/api/qual/:QualificationCode', async (req, res) => {
    const { QualificationCode } = req.params;
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
            const deleteQuery = `DELETE FROM QualificationMaster WHERE QualificationCode='${QualificationCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Qualification deleted successfully' });
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
  
  // app.delete('/api/qual/:QualificationCode', (req, res) => {
  //   const { QualificationCode } = req.params;
  //   const query = `DELETE FROM QualificationMaster WHERE QualificationCode='${QualificationCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'Qualification deleted successfully' });
  //     }
  //   });
  // }); 

  // For Gang Master------------------------------------------------------------------------------------

  // GET all gang
  app.get('/api/gang', (req, res) => {
    const query = 'SELECT * FROM GangMaster ORDER BY GangCode ASC';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // POST a new Gang
  app.post('/api/gang', (req, res) => {
    const { GangCode, GangName, GangRemark ,UserID} = req.body;

    const query = `
      INSERT INTO GangMaster (GangCode, GangName, GangRemark1 ,Userid)
      VALUES ('${GangCode}', N'${GangName}', N'${GangRemark}' ,N'${UserID}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Gang created successfully' });
      }
    });
  });

  // PUT update an existing Gang
  app.put('/api/gang/:GangCode', (req, res) => {
    const { GangCode } = req.params;
    const { GangName, GangRemark ,UserID } = req.body;

    const query = `
      UPDATE GangMaster
      SET GangName=N'${GangName}', GangRemark1=N'${GangRemark}' ,Userid=N'${UserID}'
      WHERE GangCode='${GangCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'Gang updated successfully',
            GangCode: GangCode,
            GangName,
            GangRemark,
            UserID,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // DELETE a Gang
  app.delete('/api/gang/:GangCode', async (req, res) => {
    const { GangCode } = req.params;
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
            const deleteQuery = `DELETE FROM GangMaster WHERE GangCode=${GangCode}`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Gang deleted successfully' });
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
  
  // app.delete('/api/gang/:GangCode', (req, res) => {
  //   const { GangCode } = req.params;
  //   const query = `DELETE FROM GangMaster WHERE GangCode=${GangCode}`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'Gang deleted successfully' });
  //     }
  //   });
  // }); 

  // For EmpType Master------------------------------------------------------------------------------------

  // GET all EmpType
  app.get('/api/emptype', (req, res) => {
    const query = 'SELECT * FROM EmpTypeMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  // POST a new EmpType
  app.post('/api/emptype', (req, res) => {
    const { EmpTypeCode, EmpType , UserID } = req.body;

    const query = `
      INSERT INTO EmpTypeMaster (EmpTypeCode, EmpType ,UserID)
      VALUES ('${EmpTypeCode}', N'${EmpType}',${UserID});
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'EmpType created successfully' });
      }
    });
  });

  // PUT update an existing EMpType
  app.put('/api/emptype/:EmpTypeCode', (req, res) => {
    const { EmpTypeCode } = req.params;
    const { EmpType, UserID} = req.body;

    const query = `
      UPDATE EmpTypeMaster
      SET EmpType=N'${EmpType}' UserID=${UserID} WHERE EmpTypeCode='${EmpTypeCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'EmpType updated successfully',
            EmpTypeCode: EmpTypeCode,
            EmpType,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });

  // DELETE a EmpType
  app.delete('/api/emptype/:EmpTypeCode', async (req, res) => {
    const { EmpTypeCode } = req.params;
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
            const deleteQuery = `DELETE FROM EmpTypeMaster WHERE EmpTypeCode=${EmpTypeCode}`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'EmpType deleted successfully' });
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
  
  // app.delete('/api/emptype/:EmpTypeCode', (req, res) => {
  //   const { EmpTypeCode } = req.params;
  //   const query = `DELETE FROM EmpTypeMaster WHERE EmpTypeCode=${EmpTypeCode}`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'EmpType deleted successfully' });
  //     }
  //   });
  // });

//Trai-Balance report ------------------------------------------------------------------------------------
  app.get('/api/trialbalance', (req, res) => {
    const { CompCode, DeptCode, YearCode, endDate } = req.query;
    const query = `
      DECLARE @return_value int;
  
      EXEC @return_value = [dbo].[ProcTrialBalance]
          @CompCode = @CompCode,
          @DeptCode = @DeptCode,
          @YearCode = @YearCode,
          @Trdate = @Trdate;
  
      SELECT 'Return Value' = @return_value;`;
  
    const request = new sql.Request();
    request.input('CompCode', sql.Int, CompCode);
    request.input('DeptCode', sql.Int, DeptCode);
    request.input('YearCode', sql.Int, YearCode);
    request.input('Trdate', sql.NVarChar, endDate);
  
    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  app.get('/api/stockStatement', (req, res) => {
    const { CompCode, DeptCode, YearCode, endDate, itemCode } = req.query;
    const query = `
      DECLARE @return_value int;
  
      EXEC @return_value = [dbo].[ProcItemBalance]
          @CompCode = @CompCode,
          @DeptCode = @DeptCode,
          @YearCode = @YearCode,
          @ItCode =  @ItCode,
          @Trdate = @Trdate;
  
      SELECT 'Return Value' = @return_value;`;
  
    const request = new sql.Request();
    request.input('CompCode', sql.Int, CompCode);
    request.input('DeptCode', sql.Int, DeptCode);
    request.input('YearCode', sql.Int, YearCode);
    request.input('ItCode', sql.Int, itemCode);
    request.input('Trdate', sql.NVarChar, endDate);
  
    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  app.get('/api/stockLedger', (req, res) => {
    const { CompCode, DeptCode, YearCode, endDate } = req.query;
    const query = `
      DECLARE @return_value int;
  
      EXEC @return_value = [dbo].[ProcItemLedger]
          @CompCode = @CompCode,
          @DeptCode = @DeptCode,
          @YearCode = @YearCode,
          @Trdate = @Trdate;
  
      SELECT 'Return Value' = @return_value;`;
  
    const request = new sql.Request();
    request.input('CompCode', sql.Int, CompCode);
    request.input('DeptCode', sql.Int, DeptCode);
    request.input('YearCode', sql.Int, YearCode);
    request.input('Trdate', sql.NVarChar, endDate);
  
    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  //for start and endDate
//   app.get('/api/trialbalance', (req, res) => {
//     const { CompCode, DeptCode, YearCode, startDate, endDate } = req.query;
//     const query = `
//       DECLARE @return_value int;
  
//       EXEC @return_value = [dbo].[ProcTrialBalance]
//           @CompCode = @CompCode,
//           @DeptCode = @DeptCode,
//           @YearCode = @YearCode,
//           @StartDate = @StartDate,
//           @EndDate = @EndDate;
  
//       SELECT 'Return Value' = @return_value;`;
  
//     const pool = new sql.ConnectionPool(/*Your SQL Server Configuration*/);
//     const poolConnect = pool.connect();
//     poolConnect.then(() => {
//         const request = new sql.Request(pool);
//         request.input('CompCode', sql.Int, CompCode);
//         request.input('DeptCode', sql.Int, DeptCode);
//         request.input('YearCode', sql.Int, YearCode);
//         request.input('StartDate', sql.NVarChar, startDate);
//         request.input('EndDate', sql.NVarChar, endDate);

//         request.query(query, (err, result) => {
//             if (err) {
//                 console.log('Error:', err);
//                 res.status(500).json({ error: 'Internal server error' });
//             } else {
//                 res.json(result.recordset);
//             }
//             pool.close();
//         });
//     }).catch(err => {
//         console.log('Database connection failed:', err);
//         res.status(500).json({ error: 'Database connection failed' });
//     });
// });


  app.get('/api/DayBook', (req, res) => {
    const { ledgerCode, startDate, endDate } = req.query;
    const query = `SELECT * FROM viewTranentries WHERE Accode != @Accode AND Trdate >= @StartDate AND Trdate <= @EndDate;`;
  
    const request = new sql.Request();
    request.input('Accode', sql.Int, ledgerCode);
    request.input('StartDate', sql.NVarChar, startDate);
    request.input('EndDate', sql.NVarChar, endDate);
  
    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
});

  app.get('/api/ViewTranEntries', (req, res) => {
    const {ledgerCode,  startDate, endDate} = req.query;
    const query = `select * from viewTranentries where Accode = @Accode and  Trdate >= @StartDate AND Trdate <= @EndDate;`;
  
    const request = new sql.Request();
    request.input('Accode', sql.Int, ledgerCode);
    request.input('StartDate', sql.NVarChar, startDate);
    request.input('EndDate', sql.NVarChar, endDate);
  
    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });

  app.get('/api/viewBillRegister', (req, res) => {
    const {ledgerCode,startDate, endDate , flag} = req.query;
    const query = `select * from viewBillRegister where  Trdate >= @StartDate AND Trdate <= @EndDate AND Flag =@flag;`;
  
    const request = new sql.Request();
    request.input('Accode', sql.Int, ledgerCode);
    request.input('StartDate', sql.NVarChar, startDate);
    request.input('EndDate', sql.NVarChar, endDate);
    request.input('flag', sql.NVarChar, flag);
  
    request.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
        console.log('flag:', flag);
      }
    });
  });

   // For EmployeeMaster------------------------------------------------------------------------------------
   app.get('/api/employee', (req, res) => {
    const query = 'SELECT * FROM EmployeeMaster ORDER BY EmpCode ASC';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });
  
  
  
  //Aadhar Upload
  app.post('/uploadAadhar' ,upload.single('image') ,(req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const image = req.file.filename;
    console.log("AadharCard Name : ",image);
    return res.json({Status: "Success", AadharCard: image}); 
  }); 

  
  //Pan Upload
  app.post('/uploadPan' ,upload.single('image') ,(req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const image = req.file.filename;
    console.log("Pan Name : ",image);
    return res.json({Status: "Success", PanCard: image});
  }); 
  
 
  
  //RationCard Upload 
  app.post('/uploadRC' ,upload.single('image') ,(req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const image = req.file.filename;
    console.log("RationCard Name : ",image);
    return res.json({Status: "Success", RationCard: image}); 
  }); 
  
  
  
  //License Upload 
  app.post('/uploadLicense' ,upload.single('image') ,(req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const image = req.file.filename;
    console.log("License Name : ",image);
    return res.json({Status: "Success", License: image}); 
  }); 
  
 
  
  //BirthCertificate Upload 
  app.post('/uploadBirth' ,upload.single('image') ,(req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const image = req.file.filename;
    console.log("Birth Name : ",image);
    return res.json({Status: "Success", Birth: image});
  }); 
  
 
  //PolicePatil Upload 
  app.post('/uploadPolice' ,upload.single('image') ,(req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const image = req.file.filename;
    console.log("PolicePatil Name : ",image);
    return res.json({Status: "Success", PolicePatil: image});
  }); 
  

  //Agreement Upload 
  app.post('/uploadAgreement' ,upload.single('image') ,(req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const image = req.file.filename;
    console.log("Agreement Name : ",image);
    return res.json({Status: "Success", Agreement: image});
  }); 
  
 
  app.post('/api/employee', async (req, res) => {
    const {
      EmpCode,
      KYCCode,
      EmpName,
      EmpNameEng,
      AddressCurrent,
      AddressPermanant,
      City,
      Phone,
      MobileNo,
      Email,
      AadharNo,
      PanNo,
      RationCardNo,
      PFNo,
      PensionYears,
      BankAcNo,
      BankName,
      BankIFSC,
      Gender,
      MaritalStatus,
      DateOfEmployment,
      DateOfBirth,
      DateOfRetirement,
      RetireAge,
      EmpTypeCode,
      DesigCode,
      QualificationCode,
      CasteCode,
      CompCode,
      DeptCode,
      GangCode,
      StatusCode,
      MemberCode1,
      MemberCode2,
      MemberCode3,
      PhotoPath,
      SignPath,
      AadharPath,
      PanPath,
      RationCardPath,
      LicensePath,
      BirthCertificatePath,
      PolicePatilPath,
      AgreementPath,
      Doc1Path,
      Doc2Path,
      Doc3Path,
      FamilyMembers,
      Remark1,
      Remark2,
      Remark3,
      CHECKEDBY,
      USERID
    } = req.body;
  
    const query = `
    INSERT INTO EmployeeMaster (
      EmpCode,
      KYCCode,
      EmpName,
      EmpNameEng,
      AddressCurrent,
      AddressPermanant,
      City,
      Phone,
      MobileNo,
      Email,
      AadharNo,
      PanNo,
      RationCardNo,
      PFNo,
      PensionYears,
      BankAcNo,
      BankName,
      BankIFSC,
      Gender,
      MaritalStatus,
      DateOfEmployment,
      DateOfBirth,
      DateOfRetirement,
      Age,
      EmpTypeCode,
      DesgCode,
      QualificationCode,
      CasteCode,
      CompCode,
      DeptCode,
      GangCode,
      StatusCode,
      MemberCode1,
      MemberCode2,
      MemberCode3,
      PhotoPath,
      SignPath,
      AadharPath,
      PanPath,
      RationCardPath,
      LicensePath,
      BirthCertificatePath,
      PolicePatilPath,
      AgreementPath,
      Doc1Path,
      Doc2Path,
      Doc3Path,
      FamilyMembers,
      Remark1,
      Remark2,
      Remark3,
      CHECKEDBY,
      USERID
    )
    VALUES (
      '${EmpCode}',
      '${KYCCode}',
      N'${EmpName}',
      N'${EmpNameEng}',
      N'${AddressCurrent}',
      N'${AddressPermanant}',
      N'${City}',
      '${Phone}',
      '${MobileNo}',
      '${Email}',
      '${AadharNo}',
      '${PanNo}',
      '${RationCardNo}',
      '${PFNo}',
      '${PensionYears}',
      '${BankAcNo}',
      '${BankName}',
      '${BankIFSC}',
      '${Gender}',
      '${MaritalStatus}',
      '${DateOfEmployment}',
      '${DateOfBirth}',
      '${DateOfRetirement}',
      '${RetireAge}',
      '${EmpTypeCode}',
      '${DesigCode}',
      '${QualificationCode}',
      '${CasteCode}',
      '${CompCode}',
      '${DeptCode}',
      '${GangCode}',
      '${StatusCode}',
      '${MemberCode1}',
      '${MemberCode2}',
      '${MemberCode3}',
      '${PhotoPath}',
      '${SignPath}',
      '${AadharPath}',
      '${PanPath}',
      '${RationCardPath}',
      '${LicensePath}',
      '${BirthCertificatePath}',
      '${PolicePatilPath}',
      '${AgreementPath}',
      '${Doc1Path}',
      '${Doc2Path}',
      '${Doc3Path}',
      '${FamilyMembers}',
      '${Remark1}',
      '${Remark2}',
      '${Remark3}',
      '${CHECKEDBY}',
      '${USERID}'
    );
  `;
  
    try {
      await sql.query(query);
      res.json({ message: 'Success' });
    } catch (error) {
      console.log('Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/employee/:EmpCode', async (req, res) => {
    const { EmpCode } = req.params;
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
            const deleteQuery = `DELETE FROM EmployeeMaster WHERE EmpCode='${EmpCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Employee deleted successfully' });
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
  
  // app.delete('/api/employee/:EmpCode', (req, res) => {
  //   const { EmpCode } = req.params;
  //   const query = `DELETE FROM EmployeeMaster WHERE EmpCode='${EmpCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'Employee deleted successfully' });
  //     }
  //   });
  // }); 
  
  app.put('/api/employee/:EmpCode', async (req, res) => {
    const { EmpCode } = req.params;
    const {
      KYCCode,
      EmpName,
      EmpNameEng,
      AddressCurrent,
      AddressPermanant,
      City,
      Phone,
      MobileNo,
      Email,
      AadharNo,
      PanNo,
      RationCardNo,
      PFNo,
      PensionYears,
      BankAcNo,
      BankName,
      BankIFSC,
      Gender,
      MaritalStatus,
      DateOfEmployment,
      DateOfBirth,
      DateOfRetirement,
      RetireAge,
      EmpTypeCode,
      DesgCode,
      QualificationCode,
      CasteCode,
      CompCode,
      DeptCode,
      GangCode,
      StatusCode,
      MemberCode1,
      MemberCode2,
      MemberCode3,
      PhotoPath,
      SignPath,
      AadharPath,
      PanPath,
      RationCardPath,
      LicensePath,
      BirthCertificatePath,
      PolicePatilPath,
      AgreementPath,
      Doc1Path,
      Doc2Path,
      Doc3Path,
      FamilyMembers,
      Remark1,
      Remark2,
      Remark3,
      CHECKEDBY,
      USERID
    } = req.body;
  
    const query = `
      UPDATE EmployeeMaster
      SET
        KYCCode = '${KYCCode}',
        EmpName = N'${EmpName}',
        EmpNameEng = N'${EmpNameEng}',
        AddressCurrent = N'${AddressCurrent}',
        AddressPermanant = N'${AddressPermanant}',
        City = N'${City}',
        Phone = '${Phone}',
        MobileNo = '${MobileNo}',
        Email = N'${Email}',
        AadharNo = '${AadharNo}',
        PanNo = '${PanNo}',
        RationCardNo = '${RationCardNo}',
        PFNo = '${PFNo}',
        PensionYears = '${PensionYears}',
        BankAcNo = '${BankAcNo}',
        BankName = N'${BankName}',
        BankIFSC = '${BankIFSC}',
        Gender = N'${Gender}',
        MaritalStatus = N'${MaritalStatus}',
        DateOfEmployment = '${DateOfEmployment}',
        DateOfBirth = '${DateOfBirth}',
        DateOfRetirement = '${DateOfRetirement}',
        Age = '${RetireAge}',
        EmpTypeCode = '${EmpTypeCode}',
        DesgCode = '${DesgCode}',
        QualificationCode = '${QualificationCode}',
        CasteCode = '${CasteCode}',
        CompCode = '${CompCode}',
        DeptCode = '${DeptCode}',
        GangCode = '${GangCode}',
        StatusCode = '${StatusCode}',
        MemberCode1 = '${MemberCode1}',
        MemberCode2 = '${MemberCode2}',
        MemberCode3 = '${MemberCode3}',
        PhotoPath = N'${PhotoPath}',
        SignPath = N'${SignPath}',
        AadharPath = N'${AadharPath}',
        PanPath = N'${PanPath}',
        RationCardPath = N'${RationCardPath}',
        LicensePath = N'${LicensePath}',
        BirthCertificatePath = N'${BirthCertificatePath}',
        PolicePatilPath = N'${PolicePatilPath}',
        AgreementPath = N'${AgreementPath}',
        Doc1Path = N'${Doc1Path}',
        Doc2Path = N'${Doc2Path}',
        Doc3Path = N'${Doc3Path}',
        FamilyMembers = '${FamilyMembers}',
        Remark1 = N'${Remark1}',
        Remark2 = N'${Remark2}',
        Remark3 = N'${Remark3}',
        CHECKEDBY = N'${CHECKEDBY}',
        USERID = ${USERID}
      WHERE
        EmpCode = ${EmpCode};
    `;
  
    try {
      await sql.query(query);
      res.json({ message: 'Employee updated successfully' });
    } catch (error) {
      console.log('Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // For EmpFamilyMemberMaster------------------------------------------------------------------------------------
  // GET all EmpFamilyMemberMaster
  app.get('/api/empFamily/:EmpCode', (req, res) => {
    const { EmpCode } = req.params;
    const query = `SELECT * FROM EmpFamilyMemberMaster WHERE EmpCode = ${EmpCode}`;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });
  
  app.post('/api/uploadFamilyPhoto' ,upload.single('image') ,(req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const image = req.file.filename;
    console.log("Image Name : ",image);
    return res.json({Status: "Success", FamilyMemberPhoto: image});
  });
  
  app.post('/api/uploadFamilyDoc1' ,upload.single('image') ,(req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const image = req.file.filename;
    console.log("Image Name : ",image);
    return res.json({Status: "Success", FamilyMemberDoc1: image});
  });
  
  app.post('/api/uploadFamilyDoc2' ,upload.single('image') ,(req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const image = req.file.filename;
    console.log("Image Name : ",image);
    return res.json({Status: "Success", FamilyMemberDoc2: image});
  });
  
  app.post('/api/uploadFamilyDoc3' ,upload.single('image') ,(req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const image = req.file.filename;
    console.log("Image Name : ",image);
    return res.json({Status: "Success", FamilyMemberDoc3: image});
  });
  
  app.post('/api/uploadFamilyDoc4' ,upload.single('image') ,(req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const image = req.file.filename;
    console.log("Image Name : ",image);
    return res.json({Status: "Success", FamilyMemberDoc4: image});
  });
  
  app.post('/api/uploadFamilyDoc5' ,upload.single('image') ,(req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    
    const image = req.file.filename;
    console.log("Image Name : ",image);
    return res.json({Status: "Success", FamilyMemberDoc5: image});
  });
  
  
  app.get('/api/getFamilyPhoto/:EmpCode', (req, res) => {
  const empCode = req.params.EmpCode;
  
  const query = `SELECT FamilyMemberPhoto FROM EmpFamilyMemberMaster WHERE EmpCode = '${empCode}'`;
  
  sql.query(query, (err, result) => {
    if (err) {
      console.error('Error fetching image:', err);
      return res.status(500).json({ Message: 'Error fetching image' });
    }
  
    if (result.recordset.length === 0) {
      return res.status(404).json({ Message: 'Image not found for the given EmpCode' });
    }
  
    const imagePath = path.join('D:\\Image', result.recordset[0].FamilyMemberPhoto); // Corrected path
    res.sendFile(imagePath);
  });
  });
  
  // Add Emp Family Member
  app.post('/api/empFamily', (req, res) => {
    const {
      EmpCode,
      FamilyMemberNo,
      FamilyMemberName,
      FamilyMemberDOB,
      FamilyMemberAge,
      FamilyMemberRelation,
      FamilyMemberPhoto,
      FamilyMemberDoc1,
      FamilyMemberDoc2,
      FamilyMemberDoc3,
      FamilyMemberDoc4,
      FamilyMemberDoc5,
      Remark1,
      UserID
    } = req.body;
  
    const query = `
    INSERT INTO EmpFamilyMemberMaster (
        EmpCode, 
        FamilyMemberNo,
        FamilyMemberName,
        FamilyMemberDOB,
        FamilyMemberAge,
        FamilyMemberRelation,
        FamilyMemberPhoto,
        FamilyMemberDoc1,
        FamilyMemberDoc2,
        FamilyMemberDoc3,
        FamilyMemberDoc4,
        FamilyMemberDoc5,
        Remark1,
        UserID
      )
      VALUES (
        ${EmpCode},
        ${FamilyMemberNo},
        N'${FamilyMemberName}',
        '${FamilyMemberDOB}',
        ${FamilyMemberAge},
        N'${FamilyMemberRelation}',
        '${FamilyMemberPhoto}',
        '${FamilyMemberDoc1}',
        '${FamilyMemberDoc2}',
        '${FamilyMemberDoc3}',
        '${FamilyMemberDoc4}',
        '${FamilyMemberDoc5}',
        N'${Remark1}',
        '${UserID}'
        ) 
    `;
  
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: ' EmpFamilyMember created successfully' });
      }
    });
  });
  
  app.put('/api/empFamily/:EmpCode', (req, res) => {
    const { EmpCode } = req.params;
    const {
      FamilyMemberNo,
      FamilyMemberName,
      FamilyMemberDOB,
      FamilyMemberAge,
      FamilyMemberRelation,
      FamilyMemberPhoto,
      FamilyMemberDoc1,
      FamilyMemberDoc2,
      FamilyMemberDoc3,
      FamilyMemberDoc4,
      FamilyMemberDoc5,
      Remark1
    } = req.body;
  
    const query = `
      UPDATE EmpFamilyMemberMaster
      SET
        FamilyMemberName = N'${FamilyMemberName}',
        FamilyMemberDOB = '${FamilyMemberDOB}',
        FamilyMemberAge = ${FamilyMemberAge},
        FamilyMemberRelation = N'${FamilyMemberRelation}',
        FamilyMemberPhoto = '${FamilyMemberPhoto}',
        FamilyMemberDoc1 = '${FamilyMemberDoc1}',
        FamilyMemberDoc2 = '${FamilyMemberDoc2}',
        FamilyMemberDoc3 = '${FamilyMemberDoc3}',
        FamilyMemberDoc4 = '${FamilyMemberDoc4}',
        FamilyMemberDoc5 = '${FamilyMemberDoc5}',
        Remark1 = N'${Remark1}'
      WHERE EmpCode = ${EmpCode} AND FamilyMemberNo = ${FamilyMemberNo};
  `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'EmpFamilyMember updated successfully' });
      }
    });
  });

  app.delete('/api/empFamily/:EmpCode/:FamilyMemberNo', async (req, res) => {
    const { EmpCode, FamilyMemberNo } = req.params;
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
            const deleteQuery = `
              DELETE FROM EmpFamilyMemberMaster
              WHERE EmpCode = ${EmpCode} AND FamilyMemberNo = ${FamilyMemberNo};
            `;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'EmpFamilyMember deleted successfully' });
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
  
  
  // app.delete('/api/empFamily/:EmpCode/:FamilyMemberNo', (req, res) => {
  //   const { EmpCode, FamilyMemberNo } = req.params;
  //   const query = `
  //     DELETE FROM EmpFamilyMemberMaster
  //     WHERE EmpCode = ${EmpCode} AND FamilyMemberNo = ${FamilyMemberNo};
  //   `;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'EmpFamilyMember deleted successfully' });
  //     }
  //   });
  // });
  

  // For StatusMaster------------------------------------------------------------------------------------
  // GET all Status
  app.get('/api/status', (req, res) => {
    const query = 'SELECT * FROM StatusMaster';
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json(result.recordset);
      }
    });
  });
  
  // POST a new Status
  app.post('/api/status', (req, res) => {
    const { StatusCode, StatusDesc, UserID } = req.body;
    const query = `
      INSERT INTO StatusMaster (StatusCode, StatusDesc, UserID)
      VALUES ('${StatusCode}', N'${StatusDesc}',  N'${UserID}');
    `;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Status created successfully' });
      }
    });
  });
  
  // PUT update an existing Status
  app.put('/api/status/:StatusCode', (req, res) => {
    const { StatusCode } = req.params;
    const { StatusDesc, UserID } = req.body;
    const query = `
      UPDATE StatusMaster
      SET StatusDesc=N'${StatusDesc}', UserID=N'${UserID}'
      WHERE StatusCode='${StatusCode}';
    `;
    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        if (result.rowsAffected && result.rowsAffected[0] > 0) {
          res.json({
            message: 'Status updated successfully',
            StatusCode: StatusCode,
            StatusDesc,
            UserID,
          });
        } else {
          res.status(404).json({ error: 'Record not found' });
        }
      }
    });
  });
  
  // DELETE a Status
  app.delete('/api/status/:StatusCode', async (req, res) => {
    const { StatusCode } = req.params;
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
            const deleteQuery = `DELETE FROM StatusMaster WHERE StatusCode='${StatusCode}'`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'Status deleted successfully' });
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
  
  // app.delete('/api/status/:StatusCode', (req, res) => {
  //   const { StatusCode } = req.params;
  //   const query = `DELETE FROM StatusMaster WHERE StatusCode='${StatusCode}'`;
  //   sql.query(query, (err) => {
  //     if (err) {
  //       console.log('Error:', err);
  //       res.status(500).json({ error: 'Internal server error' });
  //     } else {
  //       res.json({ message: 'Status deleted successfully' });
  //     }
  //   });
  // }); 

  // for Vehiclemaster 
// Get all Vehicle master
app.get('/api/vehicle', (req, res) => {
  const query = 'SELECT * FROM VehicleMaster';
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});

// Create a new Vehiclemaster
app.post('/api/vehicle', (req, res) => {
  const { 
    VehicleCode,
    VehicleNo,
    CategoryCode,
    OwnerName,
    ModelYear ,
    HYPDetails,
    RegNo,
    ChassisNo,
    EngineNo,
    DateOfPurchase,
    PurchaseDetails,
    InsuranceDetails,
    InsuranceExpiryDate,
    TaxDetails,
    TaxExpiryDate,
    TYRESIZE,
    TANKSIZE,
    OtherDetails,
    AvgKM,
    CapacityWeight,
    DeptCode,
    TransporterCode,
    CapacityCrate,
    RatePerKm,
    Status,
    } = req.body;
    const query = `
    INSERT INTO VehicleMaster (
      VehicleCode,
      VehicleNo,
      CategoryCode,
      OwnerName,
      ModelYear,
      HYPDetails,
      RegNo,
      ChassisNo,
      EngineNo,
      DateOfPurchase,
      PurchaseDetails,
      InsuranceDetails,
      InsuranceExpiryDate,
      TaxDetails,
      TaxExpiryDate,
      TYRESIZE,
      TANKSIZE,
      OtherDetails,
      AvgKM,
      CapacityWeight,
      DeptCode,
      TransporterCode,
      CapacityCrate,
      RatePerKm,
      Status
    )
    VALUES (
      '${VehicleCode}',
      N'${VehicleNo}',
      '${CategoryCode}',
      N'${OwnerName}',
      N'${ModelYear}',
      N'${HYPDetails}',
      N'${RegNo}',
      N'${ChassisNo}',
      N'${EngineNo}',
      '${DateOfPurchase}',
      N'${PurchaseDetails}',
      N'${InsuranceDetails}',
      '${InsuranceExpiryDate}',
      N'${TaxDetails}',
      '${TaxExpiryDate}',
      N'${TYRESIZE}',
      N'${TANKSIZE}',
      N'${OtherDetails}',
      '${AvgKM}',
      '${CapacityWeight}',
      '${DeptCode}',
      '${TransporterCode}',
      '${CapacityCrate}',
      '${RatePerKm}',
      '${Status}'
    )
  `;
  
  sql.query(query, (err) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ message: 'Vehicle created successfully' });
    }
  });
});

// Update a state by VehicleCode
app.put('/api/vehicle/:VehicleCode', (req, res) => {
  const { VehicleCode } = req.params;
  const { 
    VehicleNo,
    CategoryCode,
    OwnerName,
    ModelYear ,
    HYPDetails,
    RegNo,
    ChassisNo,
    EngineNo,
    DateOfPurchase,
    PurchaseDetails,
    InsuranceDetails,
    InsuranceExpiryDate,
    TaxDetails,
    TaxExpiryDate,
    TYRESIZE,
    TANKSIZE,
    OtherDetails,
    AvgKM,
    CapacityWeight,
    DeptCode,
    TransporterCode,
    CapacityCrate,
    RatePerKm,
    Status,
    } = req.body;
    const query = `
    UPDATE VehicleMaster 
    SET 
      VehicleNo = '${VehicleNo}',
      CategoryCode = '${CategoryCode}',
      OwnerName = '${OwnerName}',
      ModelYear = '${ModelYear}',
      HYPDetails = '${HYPDetails}',
      RegNo = '${RegNo}',
      ChassisNo = '${ChassisNo}',
      EngineNo = '${EngineNo}',
      DateOfPurchase = '${DateOfPurchase}',
      PurchaseDetails = '${PurchaseDetails}',
      InsuranceDetails = '${InsuranceDetails}',
      InsuranceExpiryDate = '${InsuranceExpiryDate}',
      TaxDetails = '${TaxDetails}',
      TaxExpiryDate = '${TaxExpiryDate}',
      TYRESIZE = '${TYRESIZE}',
      TANKSIZE = '${TANKSIZE}',
      OtherDetails = '${OtherDetails}',
      AvgKM = '${AvgKM}',
      CapacityWeight = '${CapacityWeight}',
      DeptCode = '${DeptCode}',
      TransporterCode = '${TransporterCode}',
      CapacityCrate = '${CapacityCrate}',
      RatePerKm = '${RatePerKm}',
      Status = '${Status}'
    WHERE VehicleCode = '${VehicleCode}';
  `;

  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      if (result.rowsAffected && result.rowsAffected[0] > 0) {
        res.json({
          message: 'VehicleMaster updated successfully',
          VehicleCode: VehicleCode,
        });
      } else {
        res.status(404).json({ error: 'Record not found' });
      }
    }
  });
});

// Delete a state by Vehicle
app.delete('/api/vehicle/:VehicleCode', async (req, res) => {
  const { VehicleCode } = req.params;
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
          const deleteQuery = `DELETE FROM VehicleMaster WHERE VehicleCode=${VehicleCode}`;

          sql.query(deleteQuery, (deleteErr) => {
            if (deleteErr) {
              console.log('Error deleting entry:', deleteErr);
              res.status(500).json({ error: 'Internal server error' });
            } else {
              res.json({ message: 'Vehicle deleted successfully' });
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

// app.delete('/api/vehicle/:VehicleCode', (req, res) => {
//   const { VehicleCode } = req.params;
//   const query = `DELETE FROM VehicleMaster WHERE VehicleCode=${VehicleCode}`;
//   sql.query(query, (err) => {
//     if (err) {
//       console.log('Error:', err);
//       res.status(500).json({ error: 'Internal server error' });
//     } else {
//       res.json({ message: 'Vehicle deleted successfully' });
//     }
//   });
// });



// for settingmaster 
// Get all settingmaster
app.get('/api/setting', (req, res) => {
  const query = 'SELECT * FROM SettingsMaster';
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});

// Create a new settingmaster
app.post('/api/setting', (req, res) => {
  const { 
    SettingCode,
    SettingDesc1,
    SettingValue1,
    SettingDesc2,
    SettingValue2,
    SettingDesc3,
    SettingValue3,
    UserID, 
    } = req.body;
  const query = `
    INSERT INTO SettingsMaster ( 
    SettingCode, SettingDesc1, SettingValue1, SettingDesc2, 
    SettingValue2, SettingDesc3, SettingValue3, UserID )
    VALUES (
    ${SettingCode}, N'${SettingDesc1}', N'${SettingValue1}', N'${SettingDesc2}',
    N'${SettingValue2}',N'${SettingDesc3}',N'${SettingValue3}', ${UserID} );
  `;
  sql.query(query, (err) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ message: 'Setting created successfully' });
    }
  });
});

// Update a state by SettingCode
app.put('/api/setting/:SettingCode', (req, res) => {
  const { SettingCode } = req.params;
  const { 
    SettingDesc1,
    SettingValue1,
    SettingDesc2,
    SettingValue2,
    SettingDesc3,
    SettingValue3,
    UserID, 
    } = req.body;
    const query = `
  UPDATE SettingsMaster SET 
    SettingDesc1 = N'${SettingDesc1}', 
    SettingValue1 = N'${SettingValue1}', 
    SettingDesc2 = N'${SettingDesc2}', 
    SettingValue2 = N'${SettingValue2}', 
    SettingDesc3 = N'${SettingDesc3}', 
    SettingValue3 = N'${SettingValue3}', 
    UserID = ${UserID}
  WHERE SettingCode = ${SettingCode};
`;

  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      if (result.rowsAffected && result.rowsAffected[0] > 0) {
        res.json({
          message: 'SettingMaster updated successfully',
          SettingCode: SettingCode,
          SettingDesc1,
          SettingValue1,
          SettingDesc2,
          SettingValue2,
          SettingDesc3,
          SettingValue3,
          UserID,
        });
      } else {
        res.status(404).json({ error: 'Record not found' });
      }
    }
  });
});

// Delete a state by SettingCode
app.delete('/api/setting/:SettingCode', async (req, res) => {
  const { SettingCode } = req.params;
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
          const deleteQuery = `DELETE FROM SettingsMaster WHERE SettingCode=${SettingCode}`;

          sql.query(deleteQuery, (deleteErr) => {
            if (deleteErr) {
              console.log('Error deleting entry:', deleteErr);
              res.status(500).json({ error: 'Internal server error' });
            } else {
              res.json({ message: 'Setting deleted successfully' });
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

// app.delete('/api/setting/:SettingCode', (req, res) => {
//   const { SettingCode } = req.params;
//   const query = `DELETE FROM SettingsMaster WHERE SettingCode=${SettingCode}`;
//   sql.query(query, (err) => {
//     if (err) {
//       console.log('Error:', err);
//       res.status(500).json({ error: 'Internal server error' });
//     } else {
//       res.json({ message: 'Setting deleted successfully' });
//     }
//   });
// });


// for Productmaster 
// Get all Productmaster
app.get('/api/product', (req, res) => {
  const query = 'SELECT * FROM ProductMaster';
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});

// Create a new Productmaster
app.post('/api/product', (req, res) => {
  const { 
    ProductCode,
    ProductName,
    ProductNameEng,
    Remark1,
    Remark2,
    UserID, 
    } = req.body;
  const query = `
    INSERT INTO ProductMaster (ProductCode, ProductName, ProductNameEng, Remark1, Remark2, UserID)
    VALUES (${ProductCode}, N'${ProductName}', N'${ProductNameEng}', N'${Remark1}',N'${Remark2}', ${UserID});
  `;
  sql.query(query, (err) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ message: 'Product created successfully' });
    }
  });
});

// Update a state by ProductMaster
app.put('/api/product/:ProductCode', (req, res) => {
  const { ProductCode } = req.params;
  const { 
    ProductName,
    ProductNameEng,
    Remark1,
    Remark2,
    UserID, 
    } = req.body;
    const query = `
  UPDATE ProductMaster 
  SET 
    ProductName = N'${ProductName}', 
    ProductNameEng = N'${ProductNameEng}', 
    Remark1 = N'${Remark1}', 
    Remark2 = N'${Remark2}', 
    UserID = '${UserID}'
  WHERE ProductCode = ${ProductCode};
`;

  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      if (result.rowsAffected && result.rowsAffected[0] > 0) {
        res.json({
          message: 'Product updated successfully',
          ProductCode: ProductCode,
          ProductName,
          ProductNameEng,
          Remark1,
          Remark2,
          UserID,
        });
      } else {
        res.status(404).json({ error: 'Record not found' });
      }
    }
  });
});

// Delete a state by ProductMaster
app.delete('/api/product/:ProductCode', async (req, res) => {
  const { ProductCode } = req.params;
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
          const deleteQuery = `DELETE FROM ProductMaster WHERE ProductCode='${ProductCode}'`;

          sql.query(deleteQuery, (deleteErr) => {
            if (deleteErr) {
              console.log('Error deleting entry:', deleteErr);
              res.status(500).json({ error: 'Internal server error' });
            } else {
              res.json({ message: 'Product deleted successfully' });
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

// app.delete('/api/product/:ProductCode', (req, res) => {
//   const { ProductCode } = req.params;
//   const query = `DELETE FROM ProductMaster WHERE ProductCode = ${ProductCode}`;
//   sql.query(query, (err) => {
//     if (err) {
//       console.log('Error:', err);
//       res.status(500).json({ error: 'Internal server error' });
//     } else {
//       res.json({ message: 'Product deleted successfully' });
//     }
//   });
// });



// for HamaliTypemaster 
// Get all HamaliTypemaster
app.get('/api/hamaliType', (req, res) => {
  const query = 'SELECT * FROM HamaliTypeMaster';
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});

// Create a new HamaliType
app.post('/api/hamaliType', (req, res) => {
  const { 
    HamaliTypeCode,
    HamaliType,
    HamaliTypeEng,
    UserID, 
    } = req.body;
  const query = `
    INSERT INTO HamaliTypeMaster (HamaliTypeCode, HamaliType, HamaliTypeEng, UserID)
    VALUES (${HamaliTypeCode}, N'${HamaliType}', N'${HamaliTypeEng}', ${UserID});
  `;
  sql.query(query, (err) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ message: 'HamaliType created successfully' });
    }
  });
});

// Update a state by HamaliType
app.put('/api/hamaliType/:HamaliTypeCode', (req, res) => {
  const { HamaliTypeCode } = req.params;
  const { 
    HamaliType,
    HamaliTypeEng,
    UserID, 
    } = req.body;
    const query = `
  UPDATE HamaliTypeMaster 
  SET 
    HamaliType = N'${HamaliType}', 
    HamaliTypeEng = N'${HamaliTypeEng}', 
    UserID = '${UserID}'
  WHERE 
    HamaliTypeCode = ${HamaliTypeCode};
`;

sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      if (result.rowsAffected && result.rowsAffected[0] > 0) {
        res.json({
          message: 'HamaliType updated successfully',
          HamaliTypeCode: HamaliTypeCode,
          HamaliType,
          HamaliTypeEng,
          UserID,
        });
      } else {
        res.status(404).json({ error: 'Record not found' });
      }
    }
  });
});

// Delete a state by HamaliType
app.delete('/api/hamaliType/:HamaliTypeCode', async (req, res) => {
  const { HamaliTypeCode } = req.params;
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
          const deleteQuery = `DELETE FROM HamaliTypeMaster WHERE HamaliTypeCode=${HamaliTypeCode}`;

          sql.query(deleteQuery, (deleteErr) => {
            if (deleteErr) {
              console.log('Error deleting entry:', deleteErr);
              res.status(500).json({ error: 'Internal server error' });
            } else {
              res.json({ message: 'HamaliType deleted successfully' });
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

// app.delete('/api/hamaliType/:HamaliTypeCode', (req, res) => {
//   const { HamaliTypeCode } = req.params;
//   const query = `DELETE FROM HamaliTypeMaster WHERE HamaliTypeCode=${HamaliTypeCode}`;
//   sql.query(query, (err) => {
//     if (err) {
//       console.log('Error:', err);
//       res.status(500).json({ error: 'Internal server error' });
//     } else {
//       res.json({ message: 'HamaliType deleted successfully' });
//     }
//   });
// });

// Get all Bankmaster
app.get('/api/bankmaster', (req, res) => {
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

app.post('/api/PostBankMaster', (req, res) => {
  const { 
    bankCode,
    bankName,
    bankBranch,
    bankIFSC 
    } = req.body;
  const query = `
    INSERT INTO BankMaster (  BankCode, BankName, BankBranch, BankIFSC)
    VALUES (${bankCode}, N'${bankName}', N'${bankBranch}', '${bankIFSC}');
  `;
  sql.query(query, (err) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ message: 'HamaliType created successfully' });
    }
  });
});

app.put('/api/PutBankMaster/:bankCode', (req, res) => {
  const bankCode = req.params.bankCode;
  const { bankName, bankBranch, bankIFSC } = req.body;

  const query = `
    UPDATE BankMaster 
    SET 
      BankName = N'${bankName}', 
      BankBranch = N'${bankBranch}', 
      BankIFSC = '${bankIFSC}'
    WHERE BankCode = ${bankCode};
  `;

  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      if (result.rowsAffected && result.rowsAffected[0] > 0) {
        res.json({ message: `Bank record with bankCode ${bankCode} updated successfully` });
      } else {
        res.status(404).json({ error: `Bank record with bankCode ${bankCode} not found` });
      }
    }
  });
});

app.delete('/api/DeleteBankMaster/:bankCode', async (req, res) => {
  const { bankCode } = req.params;
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
          const deleteQuery = `DELETE FROM BankMaster WHERE BankCode=${bankCode}`;

          sql.query(deleteQuery, (deleteErr) => {
            if (deleteErr) {
              console.log('Error deleting entry:', deleteErr);
              res.status(500).json({ error: 'Internal server error' });
            } else {
              res.json({ message: 'Bank deleted successfully' });
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

// app.delete('/api/DeleteBankMaster/:bankCode', (req, res) => {
//   const { bankCode } = req.params;
//   const query = `DELETE FROM BankMaster WHERE BankCode=${bankCode}`;
//   sql.query(query, (err) => {
//     if (err) {
//       console.log('Error:', err);
//       res.status(500).json({ error: 'Internal server error' });
//     } else {
//       res.json({ message: 'HamaliType deleted successfully' });
//     }
//   });
// });

//For MemberMaster
app.get('/api/member', (req, res) => {
  const query = 'SELECT * FROM MemberMaster';
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});

app.post('/api/member', async (req, res) => {
  const {
    MemberNo,
    MemberName,
    MemberNameEng,
    Address1,
    Address2,
    VillageCode,
    Phone,
    Mobile,
    Email,
    Age,
    MemberTypeCode,
    ProfessionCode,
    CasteCode,
    NomineeName,
    NomineeAddress1,
    NomineeVillageCode,
    NomineeDetails,
    Director,
    DateOfMembership,
    CurrentStatusCode,
    MemberOtherDetails1,
    MemberOtherDetails2,
    TotShares,
    SharesAmount,
    KYCCode,
    PhotoPath,
    SignPath,
    CompCode,
    USERID,
  } = req.body;

  const query = `
    INSERT INTO MemberMaster (
      MemberNo,
      MemberName,
      MemberNameEng,
      Address1,
      Address2,
      VillageCode,
      Phone,
      Mobile,
      Email,
      Age,
      MemberTypeCode,
      ProfessionCode,
      CasteCode,
      NomineeName,
      NomineeAddress1,
      NomineeVillageCode,
      NomineeDetails,
      Director,
      DateOfMembership,
      CurrentStatusCode,
      MemberOtherDetails1,
      MemberOtherDetails2,
      TotShares,
      SharesAmount,
      KYCCode,
      PhotoPath,
      SignPath,
      CompanyCode,
      USERID
    )
    VALUES (
      '${MemberNo}',
      N'${MemberName}',
      N'${MemberNameEng}',
      N'${Address1}',
      N'${Address2}',
      '${VillageCode}',
      '${Phone}',
      '${Mobile}',
      '${Email}',
      '${Age}',
      '${MemberTypeCode}',
      '${ProfessionCode}',
      '${CasteCode}',
      N'${NomineeName}',
      N'${NomineeAddress1}',
      '${NomineeVillageCode}',
      N'${NomineeDetails}',
      N'${Director}',
      '${DateOfMembership}',
      '${CurrentStatusCode}',
      N'${MemberOtherDetails1}',
      N'${MemberOtherDetails2}',
      '${TotShares}',
      '${SharesAmount}',
      '${KYCCode}',
      '${PhotoPath}',
      '${SignPath}',
      '${CompCode}',
      '${USERID}'
    );
  `;

  try {
    await sql.query(query); // Assuming you have a method like sql.query for database interaction
    res.json({ message: 'Success' });
  } catch (error) {
    console.log('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/member/:MemberNo', async (req, res) => {
  const MemberNo = req.params.MemberNo;
  const {
    MemberName,
    MemberNameEng,
    Address1,
    Address2,
    VillageCode,
    Phone,
    Mobile,
    Email,
    Age,
    MemberTypeCode,
    ProfessionCode,
    CasteCode,
    NomineeName,
    NomineeAddress1,
    NomineeVillageCode,
    NomineeDetails,
    Director,
    DateOfMembership,
    CurrentStatusCode,
    MemberOtherDetails1,
    MemberOtherDetails2,
    TotShares,
    SharesAmount,
    KYCCode,
    PhotoPath,
    SignPath,
    CompCode,
    USERID,
  } = req.body;

  // Logging for debugging
  console.log("Update Member Master - Request Body:", req.body);
  console.log("Update Member Master - Extracted Variables:", {
    MemberNo,
    MemberName,
    MemberNameEng,
    Address1,
    Address2,
    VillageCode,
    Phone,
    Mobile,
    Email,
    Age,
    MemberTypeCode,
    ProfessionCode,
    CasteCode,
    NomineeName,
    NomineeAddress1,
    NomineeVillageCode,
    NomineeDetails,
    Director,
    DateOfMembership,
    CurrentStatusCode,
    MemberOtherDetails1,
    MemberOtherDetails2,
    TotShares,
    SharesAmount,
    KYCCode,
    PhotoPath,
    SignPath,
    CompCode,
    USERID,
  });

  const query = `
    UPDATE MemberMaster
    SET
      MemberName = N'${MemberName}',
      MemberNameEng = N'${MemberNameEng}',
      Address1 = N'${Address1}',
      Address2 = N'${Address2}',
      VillageCode = '${VillageCode}',
      Phone = '${Phone}',
      Mobile = '${Mobile}',
      Email = '${Email}',
      Age = '${Age}',
      MemberTypeCode = '${MemberTypeCode}',
      ProfessionCode = '${ProfessionCode}',
      CasteCode = '${CasteCode}',
      NomineeName = N'${NomineeName}',
      NomineeAddress1 = N'${NomineeAddress1}',
      NomineeVillageCode = '${NomineeVillageCode}',
      NomineeDetails = N'${NomineeDetails}',
      Director = N'${Director}',
      DateOfMembership = '${DateOfMembership}',
      CurrentStatusCode = '${CurrentStatusCode}',
      MemberOtherDetails1 = N'${MemberOtherDetails1}',
      MemberOtherDetails2 = N'${MemberOtherDetails2}',
      TotShares = '${TotShares}',
      SharesAmount = '${SharesAmount}',
      KYCCode = '${KYCCode}',
      PhotoPath = '${PhotoPath}',
      SignPath = '${SignPath}',
      CompanyCode = '${CompCode}',
      USERID = '${USERID}'
    WHERE MemberNo = '${MemberNo}';
  `;

  try {
    await sql.query(query);
    res.json({ message: 'Success' });
  } catch (error) {
    console.log('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/member/:MemberNo', async (req, res) => {
  const MemberNo = req.params.MemberNo;
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
          const query = `DELETE FROM MemberMaster WHERE MemberNo = ${MemberNo}`;

          try {
            await sql.query(query);
            res.json({ message: 'Success' });
          } catch (error) {
            console.log('Error:', error);
            res.status(500).json({ error: 'Internal server error' });
          }
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



//For RailwayWagon
app.get('/api/railwaywagon', (req, res) => {
  const query = 'SELECT * FROM RRWagonEntry';
  sql.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});

app.post('/api/railwaywagon', async (req, res) => {
  const {
    EntryNo,
    TrDate,
    PartyCode,
    RRNo,
    TotalWagons,
    RakeDate,
    RakeTime,
    StationName,
    TotalQty,
    TotalWeight,
    DeptCode,
    YearCode,
    CompCode,
    UserID,
  } = req.body;


  const query = `
      INSERT INTO RRWagonEntry (
        EntryNo,
        TrDate,
        PartyCode,
        RRNo,
        TotalWagons,
        RakeDate,
        RakeTime,
        StationCode,
        TotalQty,
        TotalWeight,
        DeptCode,
        YearCode,
        Compcode,
        UserID
      )
      VALUES (
        '${EntryNo}',
        '${TrDate}',
        '${PartyCode}',
        '${RRNo}',
        '${TotalWagons}',
        '${RakeDate}',
        '${RakeTime}',
        N'${StationName}',
        '${TotalQty}',
        '${TotalWeight}',
        '${DeptCode}',
        '${YearCode}',
        '${CompCode}',
        '${UserID}'
      );
    `;

  try {
    await sql.query(query); // Assuming you have a method like sql.query for database interaction
    res.json({ message: 'Success' });
  } catch (error) {
    console.log('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/railwaywagon/:EntryNo', async (req, res) => {
  const EntryNo = req.params.EntryNo;
  const {
    TrDate,
    PartyCode,
    RRNo,
    TotalWagons,
    RakeDate,
    RakeTime,
    StationName,
    TotalQty,
    TotalWeight,
    DeptCode,
    YearCode,
    CompCode,
    UserID,
  } = req.body;

  const query = `
    UPDATE RRWagonEntry
    SET
      TrDate = '${TrDate}',
      PartyCode = '${PartyCode}',
      RRNo = '${RRNo}',
      TotalWagons = '${TotalWagons}',
      RakeDate = '${RakeDate}',
      RakeTime = '${RakeTime}',
      StationCode = N'${StationName}',
      TotalQty = '${TotalQty}',
      TotalWeight = '${TotalWeight}',
      DeptCode = '${DeptCode}',
      YearCode = '${YearCode}',
      Compcode = '${CompCode}',
      UserID = '${UserID}'
    WHERE
    EntryNo = '${EntryNo}';
  `;

  try {
    await sql.query(query); // Assuming you have a method like sql.query for database interaction
    res.json({ message: 'Success' });
  } catch (error) {
    console.log('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.delete('/api/railwaywagon/:EntryNo', async (req, res) => {
  const EntryNo = req.params.EntryNo;
  const UserName = req.headers['username'];

  try {
    // Fetch user permissions from the database based on the user making the request
    const userPermissionsQuery = `SELECT AllowEntryDelete FROM Users WHERE UserName='${UserName}'`;

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
          const query = `DELETE FROM RRWagonEntry WHERE EntryNo = ${EntryNo}`;

          try {
            await sql.query(query);
            res.json({ message: 'Success' });
          } catch (error) {
            console.log('Error:', error);
            res.status(500).json({ error: 'Internal server error' });
          }
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


  // For GangSubMaster------------------------------------------------------------------------------------

  // GET all gang
  app.get('/api/gangsub', (req, res) => {
    const query = 'SELECT * FROM GangSubMaster ORDER BY GangCode ASC';
    // const query = 'SELECT DISTINCT GangCode FROM GangSubMaster ORDER BY GangCode ASC';
    sql.query(query, (err, result) => {
        if (err) {
            console.log('Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            res.json(result.recordset);
        }
    });
});

 // POST a new Gang
app.post('/api/gangsub', (req, res) => {
  const { GangCode, EmpCodes, Remark1, UserID } = req.body;

  // Assuming EmpCodes is an array of employee codes
  const values = EmpCodes.map(EmpCode => `(${GangCode}, ${EmpCode}, '${Remark1}', ${UserID})`).join(',');

  const query = `
    INSERT INTO GangSubMaster (GangCode, EmpCode, Remark1, UserID)
    VALUES ${values};
  `;

  sql.query(query, (err) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ message: 'Gang created successfully' });
    }
  });
});

 app.post('/api/gangsubb/:GangCode', (req, res) => {
  const requestData = req.body;
  const GangCode = req.params.GangCode;

  const values = requestData.map(entry => `( 
      ${entry.GangCode}, 
      ${entry.EmpCode}, 
      '${entry.Remark1}',
      ${entry.UserID}
  )`).join(',');

  let query = `
    DELETE FROM GangSubMaster WHERE GangCode = ${GangCode};

      INSERT INTO GangSubMaster ( 
          GangCode, 
          EmpCode, 
          Remark1,
          UserID  
      ) VALUES ${values};`;

  sql.query(query, (err, result) => {
      if (err) {
          console.log('Error:', err);
          res.status(500).json({ error: 'Internal server error' });
      } else {
          res.json({ message: 'Data saved successfully' });
      }
  });
});

  // DELETE a Gang
  app.delete('/api/gangsub/:GangCode', async (req, res) => {
    const { GangCode } = req.params;
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
            const deleteQuery = `DELETE FROM GangSubMaster WHERE GangCode=${GangCode}`;
  
            sql.query(deleteQuery, (deleteErr) => {
              if (deleteErr) {
                console.log('Error deleting entry:', deleteErr);
                res.status(500).json({ error: 'Internal server error' });
              } else {
                res.json({ message: 'GangSub deleted successfully' });
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

  app.delete('/api/gangsubmaster/:Remark1', (req, res) => {
    const { Remark1 } = req.params;
    const query = `DELETE FROM GangSubMaster WHERE Remark1='${Remark1}'`;
    sql.query(query, (err) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Gang deleted successfully' });
      }
    });
  });


//For Bill Entry
app.get('/api/billentry/:flag', (req, res) => {
  const flag = req.params.flag;
  
  const query = `
    SELECT *
    FROM Billsub
    WHERE FLAG = @flag`;

  const request = new sql.Request();
  request.input('flag', sql.NVarChar, flag); 

  request.query(query, (err, result) => {
    if (err) {
      console.log('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(result.recordset);
    }
  });
});


app.post('/api/billentry/:EntryNo/:Flag', (req, res) => {
  try {
    const EntryNo = req.params.EntryNo;
    const Flag = req.params.Flag;
    const entryData = req.body;

    const values = entryData.map(entry => `(
      ${entry.ENTRYNO}, 
      '${entry.FLAG}',
      '${entry.TRDATE}', 
      ${entry.AMOUNT || 0},
      '${entry.ACCODE}',
      '${entry.ITCODE}',
      '${entry.BILLNO}',
      '${entry.BILLDATE}',
      '${entry.DESC1}',
      '${entry.DESC2}',
      '${entry.MRP}',
      ${entry.QTY || 0},
      ${entry.RATE || 0},
      ${entry.DISCAMT || 0},
      ${entry.TAXABLEAMT || 0},
      '${entry.GSTRATECODE}',
      ${entry.GSTRATE || 0},
      ${entry.CGSTAMT || 0},
      ${entry.SGSTAMT || 0},
      ${entry.IGSTAMT || 0},
      ${entry.ROUNDOFF || 0},
      ${entry.NETAMT || 0},
      ${entry.DeptCode || 0},
      ${entry.YearCode || 0},
      ${entry.CompCode || 0},
      ${entry.USERID || 0},
      ${entry.uniqueCode || 0}
    )`).join(',');
    
    console.log("Entry Data :",values)

    const query = `
      DELETE FROM Billsub WHERE ENTRYNO = '${EntryNo}' AND FLAG = '${Flag}';

      INSERT INTO Billsub (
      ENTRYNO,
      FLAG,  
      TRDATE,
      AMOUNT,
      ACCODE,
      ITCODE,
      BILLNO,
      BILLDATE,
      DESC1,
      DESC2,
      MRP,
      QTY,
      RATE,
      DISCAMT,
      TAXABLEAMT,
      GSTRATECODE,
      GSTRATE,
      CGSTAMT,
      SGSTAMT,
      IGSTAMT,
      ROUNDOFF,
      NETAMT,
      DeptCode,
      YearCode,
      CompCode,
      USERID,
      COMPUTERID
        ) VALUES ${values};`;

    sql.query(query, (err, result) => {
      if (err) {
        console.log('Error:', err);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.json({ message: 'Data saved successfully' });
      }
    });
  } catch (error) {
    console.log('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

