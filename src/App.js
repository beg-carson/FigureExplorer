import React, { useState, useEffect } from "react";
import initSqlJs from "sql.js";
import "./App.css";
import Fuse from "fuse.js";

// Required to let webpack 4 know it needs to copy the wasm file to our assets
import sqlWasm from "!!file-loader?name=sql-wasm-[contenthash].wasm!sql.js/dist/sql-wasm.wasm";

function PublicationSelect({ options, selectedOption, handleOptionChange }) {
  const truncateTitle = (text, maxLength = 120) => { // Define a function to truncate text
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  };

  return (
    <div>
      <select value={selectedOption} onChange={handleOptionChange}>
        <option value="">Select a Publication</option>
        <option value="all">Show All Figures</option>
        {options.map((option) => (
          <option key={option.pubcode} value={option.pubcode}>
            {option.pubcode}: {truncateTitle(option.title)}
          </option>
        ))}
      </select>
    </div>
  );
}

function CaptionSearch({ handleSubmit, searchTerm, handleChange }) {
  return (
    <form onSubmit={handleSubmit} className="caption-search-form">
      <input
        type="text"
        value={searchTerm}
        onChange={handleChange}
        placeholder="Search figure captions..."
      />
      <button type="submit">Search</button>
    </form>
  );
}

export default function App() {
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [navType, setNavType] = useState("");
  const [figures, setFigures] = useState([]);
  const [db, setDb] = useState(null);
  const [allFigures, setAllFigures] = useState(false);
  const [selectedFigure, setSelectedFigure] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [filterOptions, setFilterOptions] = useState({
    geologicMap: false,
    indexMap: false,
    isopachMap: false,
    photograph: false,
    structureMap: false,
    crossSection: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("./BEGFigures.db");
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const SQL = await initSqlJs({ locateFile: () => sqlWasm });
        const database = new SQL.Database(uint8Array);
        setDb(database);
      } catch (error) {
        console.error(error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (db) {
      const result = db.exec(
        "SELECT DISTINCT pubcode, title FROM pubs ORDER BY pubcode"
      );
      const options = result[0].values.map(row => ({
        pubcode: row[0],
        title: row[1],
      }));
      setOptions(options);
    }
  }, [db]);

  useEffect(() => {
    if (db) {
      let query =
        selectedOption === "all"
          ? "SELECT f.ID, f.pubcode, f.figurenumber, f.caption, f.pagenumber, f.filenames, f.figuretype, p.title FROM figures f JOIN pubs p ON f.pubcode = p.pubcode"
          : `SELECT f.ID, f.pubcode, f.figurenumber, f.caption, f.pagenumber, f.filenames, f.figuretype, p.title FROM figures f JOIN pubs p ON f.pubcode = p.pubcode WHERE f.pubcode = '${selectedOption}'`;
      const result = db.exec(query);
      if (result && result.length > 0 && result[0].values) {
        const figures = result[0].values.map((row) => {
          let filenames = [];
          if (row[5] && typeof row[5] === "string") {
            filenames = row[5].includes(",") ? row[5].split(",") : [row[5]];
          }
          return {
            ID: row[0],
            pubcode: row[1],
            figurenumber: row[2],
            caption: row[3],
            pagenumber: row[4],
            filenames,
            figuretype: row[6],
            title: row[7],
          };
        });
  
        applyFilters(figures);
      } else {
        // Handle the case when the result is undefined or doesn't have the expected structure
        applyFilters([]);
      }
    }
  }, [db, selectedOption, filterOptions]);

  useEffect(() => {
    if (searchTerm && figures.length > 0) {
      const options = {
        keys: ["caption"],
        ignoreLocation: true,
        threshold: 0.1,
      };

      const fuse = new Fuse(figures, options);
      const results = fuse.search(searchTerm);
      setSearchResults(results.map(result => result.item));
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, figures, filterOptions]);

  const handleSubmit = e => {
    e.preventDefault();
    setSubmitted(true);
    handleSearch();
  };

  const handleChange = e => {
    setSearchTerm(e.target.value);
    setSubmitted(false);
  };

  const handleSearch = () => {
    if (searchTerm) {
      const options = {
        keys: ["caption"],
        ignoreLocation: true,
        threshold: 0.1,
      };
  
      const fuse = new Fuse(figures, options);
      let filteredResults = fuse.search(searchTerm).map(result => result.item);
      setSearchResults(filteredResults);
    }
    console.log(searchTerm);
  };
  

  const handleOptionChange = (event) => {
    setSelectedOption(event.target.value);
    if (event.target.value === "all") {
      setAllFigures(true);
      applyFilters(figures);
    } else {
      setAllFigures(false);
      applyFilters(figures.filter((figure) => figure.pubcode === event.target.value));
    }
    setSubmitted(false); // Reset the submitted state
  };
  
  
  const applyFilters = (figures) => {
    const filteredFigures = figures.filter((figure) => {
      // If no filter option is selected, show all figures
      if (
        (!filterOptions.geologicMap &&
          !filterOptions.indexMap &&
          !filterOptions.isopachMap &&
          !filterOptions.photograph &&
          !filterOptions.structureMap &&
          !filterOptions.crossSection) ||
        (filterOptions.geologicMap && figure.figuretype === "geologic map") ||
        (filterOptions.indexMap && figure.figuretype === "index map") ||
        (filterOptions.isopachMap && figure.figuretype === "isopach map") ||
        (filterOptions.photograph && figure.figuretype === "photograph") ||
        (filterOptions.structureMap && figure.figuretype === "structure map") ||
        (filterOptions.crossSection && figure.figuretype === "cross section")
      ) {
        return true;
      }
      return false;
    });
  
    setFigures(filteredFigures);
  };

  const handleNavType = (event) => {
    setNavType(event.target.value);
    if (event.target.value === "search") {
      setSelectedOption("all");
      setAllFigures(true);
    } else {
      setSelectedOption("");
      setAllFigures(false);
    }
  };

  const handleFilterChange = event => {
    const { name, checked } = event.target;
    setFilterOptions(prevOptions => ({
      ...prevOptions,
      [name]: checked,
    }));
  };

  const handleFigureClick = figure => {
    setSelectedFigure(figure);
    setCurrentImageIndex(0);
  };

  const handlePubClick = publication => {
    setNavType("");
    setSelectedOption(publication.pubcode);
    setAllFigures(false);
    applyFilters(figures.filter((figure) => figure.pubcode === publication.pubcode));
    setSubmitted(false); // Reset the submitted state
  };

  const closeModal = () => {
    setSelectedFigure(null);
  };

  const handlePrevImage = () => {
    setCurrentImageIndex(prevIndex =>
      prevIndex === 0 ? selectedFigure.filenames.length - 1 : prevIndex - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prevIndex =>
      prevIndex === selectedFigure.filenames.length - 1 ? 0 : prevIndex + 1
    );
  };

  const renderFilterCheckboxes = () => {
    return (
      <div className="filter-options">
        Filter by:
        <label>
          <input
            type="checkbox"
            name="geologicMap"
            checked={filterOptions.geologicMap}
            onChange={handleFilterChange}
          />
          Geologic Map
        </label>
        <label>
          <input
            type="checkbox"
            name="indexMap"
            checked={filterOptions.indexMap}
            onChange={handleFilterChange}
          />
          Index Map
        </label>
        <label>
          <input
            type="checkbox"
            name="isopachMap"
            checked={filterOptions.isopachMap}
            onChange={handleFilterChange}
          />
          Isopach Map
        </label>
        <label>
          <input
            type="checkbox"
            name="photograph"
            checked={filterOptions.photograph}
            onChange={handleFilterChange}
          />
          Photograph
        </label>
        <label>
          <input
            type="checkbox"
            name="structureMap"
            checked={filterOptions.structureMap}
            onChange={handleFilterChange}
          />
          Structure Map
        </label>
        <label>
          <input
            type="checkbox"
            name="crossSection"
            checked={filterOptions.crossSection}
            onChange={handleFilterChange}
          />
          Cross Section
        </label>
      </div>
    );
  };

  const renderFigureList = () => {
    const results = submitted && searchTerm ? searchResults : figures;
  
    if (!submitted && navType === "search") {
      return null;
    }
  
    if (results.length === 0) {
      return null;
    }
  
    return (
      <ul>
        {results.map((figure) => (
          <li key={figure.ID}>
            <span onClick={() => handleFigureClick(figure)}>
              <b>Figure {figure.figurenumber}.</b> {figure.caption} [pg. {figure.pagenumber}]
              </span>
            <div className="popup" onClick={() => handlePubClick(figure)}>
              {allFigures && <span>&nbsp;from: <b>{figure.pubcode}</b></span>}
              <span className="popuptext">{figure.title}</span>
            </div>
          </li>
        ))}
      </ul>
    );
  };
  

  return (
    <div className="App">
      <h2>BEG Publication Figure Explorer</h2>
      <select value={navType} onChange={handleNavType}>
        <option value="list">Browse by Publication</option>
        <option value="search">Search the Figures</option>
      </select>
      {navType !== "search" ? (
        <PublicationSelect
          options={options}
          selectedOption={selectedOption}
          handleOptionChange={handleOptionChange}
        />
      ) : (
        <CaptionSearch
          handleSubmit={handleSubmit}
          searchTerm={searchTerm}
          handleChange={handleChange}
        />
      )}
      {renderFilterCheckboxes()}
      {renderFigureList()}
      {selectedFigure && (
        <div className="modal">
          <span className="close" onClick={closeModal}>
            &times;
          </span>
          <div className="modal-content">
            <img
              src={"./images/" + selectedFigure.pubcode + "/" + selectedFigure.filenames[currentImageIndex]}
              alt={selectedFigure.caption}
            />
            {selectedFigure.filenames.length > 1 && (
              <div className="image-navigation">
                <button onClick={handlePrevImage}>&lt;</button>
                <button onClick={handleNextImage}>&gt;</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
