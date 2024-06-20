const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSZMRkkQWNEz6zzcOaI3PwJohV6rqS6cYl5rTJm0LrQb9hthouOMdf4YfuDXr2bDgny9F7fHjSo9S8J/pub?output=csv';
//const spreadsheetUrl = 'http://127.0.0.1:8080/data/data.csv';

const statusColors = {
  'N/A': "#303bc9",
  'EoC': '#fec44f',
  'Retracted': '#e02d19',
};

let selectedCitation = "Self_Citations";
let isGrouped = false;
let isLogged = false;
let height_per_journal = 40

d3.csv(spreadsheetUrl)
  .then(data => {
    data.sort((a, b) => {
      const order = ['N/A', 'EoC', 'Retracted'];
      const statusIndexA = order.indexOf(a.Status);
      const statusIndexB = order.indexOf(b.Status);
      return statusIndexA - statusIndexB || a.Journal_Name.localeCompare(b.Journal_Name);
    });

    const groupedData = d3.group(data, d => d.Journal_Name);
    const sortedGroupedData = Array.from(groupedData.entries()).sort((a, b) => b[1].length - a[1].length);

    let maxCount = d3.max(sortedGroupedData, d => d[1].length);

    let min_value = 10;
    let max_value = 14;

    const margin = { top: 20, right: 20, bottom: 50, left: 200 };
    const width = 1200 - margin.left - margin.right;
    const height = 800 - margin.top - margin.bottom;

    d3.select("#log-scale-checkbox").on("change", updateVisualization);
    d3.select("#grouped-checkbox").on("change", updateVisualization);

    const svg = d3.select("#chart")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const xScale = d3.scaleLinear()
      .domain([0, maxCount + 1])
      .range([0, width]);

    const yScale = d3.scaleBand()
      .range([0, height])
      .padding(0.1);

    svg.append("g")
      .attr("class", "x-axis axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(xScale));

    svg.append("g")
      .attr("class", "y-axis axis")
      .call(d3.axisLeft(yScale).tickSize(0));

    let filteredData = sortedGroupedData;
    filteredData = sortedGroupedData.filter(entry => {
      const count = entry[1].length;
      return count >= min_value && count <= max_value;
    });

    yScale.domain(filteredData.map(d => d[0]));

    initiateFilters();

    function initiateFilters() {
      const selectIRBNumber = d3.select("#IRBNumberSelect")
        .on("change", function () {
          const selectedIRBNumber = this.value;
          if (selectedIRBNumber === "All") {
            filteredData = sortedGroupedData;
          } else {
            filteredData = sortedGroupedData.map(group => {
              const filteredItems = group[1].filter(item => String(item.IRB_Number) === String(selectedIRBNumber));
              return [group[0], filteredItems];
            }).filter(group => group[1].length > 0);
          }
          updateVisualization();
        });

      const selectAuthor = d3.select("#AuthorSelect")
        .on("change", function () {
          const selectedAuthor = this.value;
          if (selectedAuthor === "All") {
            filteredData = sortedGroupedData;
          } else {
            filteredData = sortedGroupedData.map(group => {
              const filteredItems = group[1].filter(item => item.Author.includes(selectedAuthor));
              return [group[0], filteredItems];
            }).filter(group => group[1].length > 0);
          }
          updateVisualization();
        });

      selectIRBNumber.append("option").text("All").attr("value", "All");

      const uniqueIRBNumbers = Array.from(new Set(data.map(d => d.IRB_Number)));
      uniqueIRBNumbers.forEach(number => {
        selectIRBNumber.append("option").text(number).attr("value", number);
      });

      selectAuthor.append("option").text("All").attr("value", "All");

      const uniqueAuthors = Array.from(new Set(data.map(d => d.Author)));
      uniqueAuthors.forEach(author => {
        selectAuthor.append("option").text(author).attr("value", author);
      });

      const selectMinNumberPapers = d3.select("#MinNumberSelect")
        .on("change", function () {
          min_value = +this.value;
          filteredData = sortedGroupedData.filter(entry => {
            const count = entry[1].length;
            return count >= min_value && count <= max_value;
          });
          updateVisualization();
        });

      const selectMaxNumberPapers = d3.select("#MaxNumberSelect")
        .on("change", function () {
          max_value = +this.value;
          filteredData = sortedGroupedData.filter(entry => {
            const count = entry[1].length;
            return count >= min_value && count <= max_value;
          });
          updateVisualization();
        });

      let total_max = 150;
      for (let i = 0; i <= total_max; i++) {
        selectMinNumberPapers.append("option")
          .text(i.toString())
          .attr("value", i);

        selectMaxNumberPapers.append("option")
          .text(i.toString())
          .attr("value", i);
      }

      const legend = d3.select("#legend");

      Object.entries(statusColors).forEach(([status, color]) => {
        const legendItem = legend.append("div").attr("class", "legend-item");
        legendItem.append("div")
          .attr("class", "legend-item__color")
          .style("background-color", color);
        legendItem.append("span").text(status);
      });

      selectCitationType = d3.select("#citationType")
        .on("change", function () {
          updateVisualization();
        });
    }

    function computeValueLogDependant(value) {
      if (isLogged)
        return Math.log(value);
      else
        return value;
    }

    function updateVisualization() {
      isGrouped = d3.select("#grouped-checkbox").property("checked");
      isLogged = d3.select("#log-scale-checkbox").property("checked");
      selectedCitation = d3.select("#citationType").property("value");
      yScale.domain(filteredData.map(d => d[0]));

      const numberOfJournals = yScale.domain().length;
      const padding = 3
      const newHeight = numberOfJournals * height_per_journal + padding * numberOfJournals; 
      d3.select("#chart")
        .attr("height", newHeight + margin.top + margin.bottom);
      svg.attr("height", newHeight + margin.top + margin.bottom);
      yScale.range([0, newHeight]);

      const barGroups = svg.selectAll(".bar-group")
        .data(filteredData, d => d[0]);

      barGroups.exit()
        .transition()
        .duration(500)
        .attr("opacity", 0)
        .remove();

      const enterBars = barGroups.enter()
        .append("g")
        .attr("class", "bar-group");

      maxCount = d3.max(filteredData, d => d[1].length);
      xScale.domain([0, maxCount + 1]);

      const maxRadius = d3.min([yScale.bandwidth() / 2, xScale(1) - xScale(0)]);
      const pointRadiusThreshold = 0.01 * width;

      svg.selectAll(".stacked-bar-group, .circle-point, .circle-citation").remove();

      //if (isGrouped || maxRadius < pointRadiusThreshold) {
      if (isGrouped) {
        displayBars(enterBars, barGroups);
      } else {
        displayCircles(enterBars, barGroups, maxRadius);
      }

      updateAxes(newHeight);
    }

    function displayBars(enterBars, barGroups) {
      let bars = enterBars.merge(barGroups).selectAll(".stacked-bar-group")
        .data(d => {
          const statusData = Object.entries({ 'N/A': 0, 'EoC': 0, 'Retracted': 0 })
            .map(([status]) => {
              const statusCount = d[1].filter(item => item.Status === status).length;
              return { status, count: statusCount };
            });

          return [{ Journal_Name: d[0], statusData: statusData }];
        });

      const barGroupsEnter = bars.enter()
        .append("g")
        .attr("class", "stacked-bar-group")
        .attr("transform", d => `translate(${xScale(0)}, ${yScale(d.Journal_Name)})`);

      barGroupsEnter.merge(bars).selectAll(".stacked-bar")
        .data(d => d.statusData)
        .enter()
        .append("rect")
        .attr("class", "stacked-bar")
        .attr("x", (d, i, nodes) => {
          let prevWidth = d3.sum(d3.select(nodes[i].parentNode).datum().statusData.slice(0, i), item => item.count);
          return xScale(prevWidth);
        })
        .attr("y", 0)
        .attr("width", d => xScale(d.count))
        .attr("height", yScale.bandwidth())
        .attr("fill", d => statusColors[d.status]);
    }

    function displayCircles(enterBars, barGroups, maxRadius) {
      const citationScale = d3.scaleLinear()
        .domain([0, d3.max(filteredData.flatMap(d => d[1]), d => parseFloat(d[selectedCitation]))])
        .range([5, Math.pow(maxRadius, 2)]);

      let circles = enterBars.merge(barGroups).selectAll(".circle-citation")
        .data(d => d[1])
        .enter()
        .append("circle")
        .attr("class", "circle-citation")
        .attr("cx", (d, i) => xScale(i + 1))
        .attr("cy", d => yScale(d.Journal_Name) + yScale.bandwidth() / 2)
        .attr("r", d => {
          let value = computeValueLogDependant(parseFloat(d[selectedCitation]));
          return (parseFloat(d[selectedCitation]) === 0 ? 5 : Math.sqrt(citationScale(value)));
        })
        .attr("fill", d => statusColors[d.Status])
        .attr("fill-opacity", 0.3)
        .attr("original-fill", d => statusColors[d.Status])
        .attr("id", d => "point_" + d.Line_ID)
        .on("mouseover", function (event, d) {
          d3.select(this).attr("fill", "yellow");
          d3.select("#point_" + d.Line_ID).attr("fill", "yellow");
          updateInfo(d);
        })
        .on("mouseout", function (event, d) {
          let tmp = d3.select(this);
          tmp.attr("fill", tmp.attr("original-fill"));
          tmp = d3.select("#point_" + d.Line_ID);
          tmp.attr("fill", tmp.attr("original-fill"));
        })
        .transition()
        .duration(500);

      const legend = d3.select("#legend");
      const legendValues = [0, 0.25, 0.5, 0.75, 1].map(d => d * d3.max(filteredData.flatMap(d => d[1]), d => parseFloat(d[selectedCitation])));
      const legendRadius = legendValues.map(d => Math.sqrt(citationScale(d)));

      legend.selectAll(".circle-size-legend").remove();

      const sizeLegend = legend.append("g")
        .attr("class", "circle-size-legend")
        .attr("transform", `translate(100, 100)`);

      sizeLegend.selectAll("circle")
        .data(legendRadius)
        .enter()
        .append("circle")
        .attr("cx", (d, i) => i * 50 + 10)
        .attr("cy", 10)
        .attr("r", d => d)
        .attr("fill", "gray")
        .attr("fill-opacity", 0.3);

      sizeLegend.selectAll("text")
        .data(legendValues)
        .enter()
        .append("text")
        .attr("x", (d, i) => i * 50 + 10)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .text(d => Math.round(d));
    }

    updateVisualization();
    //updateAxes();

    function updateAxes(newHeight) {
      svg.select(".x-axis")
        .attr("transform", "translate(0," + newHeight + ")")
        .call(d3.axisBottom(xScale));
      svg.select(".y-axis")
        .call(d3.axisLeft(yScale).tickSize(0))
        .selectAll(".tick text")
        .call(wrap, margin.left - 10);
    }
  })
  .catch(error => {
    console.error('Error fetching the data:', error);
  });

function updateInfo(d) {
  d3.select("#DOI").html(`<a href="https://doi.org/${d.DOI}" target="_blank">${d.DOI}</a>`);
  d3.select("#Title").text(d.Title);
  d3.select("#Journal_Name").text(d.Journal_Name);
  d3.select("#Status").text(d.Status);
  d3.select("#IRB_Number").text(d.IRB_Number);
  d3.select("#Citations").text(d.Citations);
  d3.select("#Self_Citations").text(d.Self_Citations);
  d3.select("#Altmetrics").text(d.Altmetrics);
  if (d.DOI_Status) {
    d3.select("#DOI_Status").html(`<a href="${d.DOI_Status}" target="_blank">${d.DOI_Status}</a>`);
  } else {
    d3.select("#DOI_Status").text('N/A');
  }
}

// Wrapping function
function wrap(text, width) {
  text.each(function () {
    const text = d3.select(this);
    const words = text.text().split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.1;
    const y = text.attr("y");
    const dy = parseFloat(text.attr("dy"));
    let tspan = text.text(null).append("tspan").attr("x", -10).attr("y", y).attr("dy", `${dy}em`);
    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text.append("tspan").attr("x", -10).attr("y", y).attr("dy", `${++lineNumber * lineHeight + dy}em`).text(word);
      }
    }
  });
}
