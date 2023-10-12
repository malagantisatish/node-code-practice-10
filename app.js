const express = require("express");
const app = express();
app.use(express.json());

const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const bcrypt = require("bcrypt");

let db = null;

let initializationDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3001, () => {
      console.log("Server starting at http://localhost:3001");
    });
  } catch (error) {
    console.log(`Error at ${error.message}`);
  }
};

initializationDBAndServer();

const convertStateData = (data) => {
  return {
    stateId: data.state_id,
    stateName: data.state_name,
    population: data.population,
  };
};

const covertDistrictData = (data) => {
  return {
    districtId: data.district_id,
    districtName: data.district_name,
    stateId: data.state_id,
    cured: data.cured,
    deaths: data.deaths,
    active: data.active,
    cases: data.cases,
  };
};

function checkTheAuthentication(request, response, next) {
  const authHeader = request.headers["authorization"];
  console.log(authHeader);
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "satish", async (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

// login api

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const usernameVerifyQuery = `SELECT * FROM user WHERE username='${username}'`;

  const userDetails = await db.get(usernameVerifyQuery);

  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    //verify the password
    const isPasswordMatched = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "satish");
      console.log(jwtToken);
      response.status(200);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// api -2  get the state

app.get("/states/", checkTheAuthentication, async (request, response) => {
  const getStatesListQuery = `SELECT * 
           FROM state;`;
  const stateArray = await db.all(getStatesListQuery);
  response.status(200);
  response.send(stateArray.map((each) => convertStateData(each)));
});

// api-3

app.get(
  "/states/:stateId/",
  checkTheAuthentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatesListQuery = `SELECT *
           FROM state 
           WHERE state_id=${stateId};`;
    const stateArray = await db.get(getStatesListQuery);
    response.status(200);
    response.send(convertStateData(stateArray));
  }
);

// api-4 add district to district list

app.post("/districts/ ", checkTheAuthentication, async (request, response) => {
  const { stateId, districtName, cured, active, deaths, cases } = request.body;
  const AddedDistrictQuery = `INSERT INTO 
  district (state_id, district_name, cases,cured, active,deaths) 
        VALUES (${stateId}, '${districtName}', ${cases}, ${cured}, ${active}, ${deaths})
        ;`;
  await db.run(AddedDistrictQuery);
  response.status(200);
  response.send("District Successfully Added");
});

// api -5 get specific district details

app.get(
  "/districts/:districtId/",
  checkTheAuthentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictDetails = `SELECT
         *
           FROM district 
           WHERE district_id=${districtId};`;
    const districtDetails = await db.get(getDistrictDetails);
    response.status(200);
    response.send(covertDistrictData(districtDetails));
  }
);

// api-6

app.delete(
  "/districts/:districtId/",
  checkTheAuthentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district
           WHERE district_id=${districtId};`;
    await db.run(deleteDistrictQuery);
    response.status(200);
    response.send("District Removed");
  }
);

//api -7 update the district

app.put(
  "/districts/:districtId/",
  checkTheAuthentication,
  async (request, response) => {
    const { districtName, stateId, cured, active, deaths } = request.body;
    const { districtId } = request.params;
    const updateDistrictQuery = `UPDATE district SET 
        district_name='${districtName}',
         state_id=${stateId},
         cured=${cured},
         active=${active},
         deaths=${deaths}
           WHERE district_id=${districtId};`;
    await db.run(updateDistrictQuery);
    response.status(200);
    response.send("District Details Updated");
  }
);

// api-8

app.get(
  "/states/:stateId/stats/",
  checkTheAuthentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getTheStatsQuery = `SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths) 
      FROM district 
      WHERE state_id=${stateId};`;

    const stats = await db.get(getTheStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
