
d3.select("body").append("div").attr("id", "choropleth-container");
d3.select("body").append("div").attr("id", "linechart-container");
d3.select("body").append("div").attr("id", "treemap-container");
d3.select("body").append("div").attr("id", "stacked-container");
d3.select("body").append("div").attr("id", "ranking-container");

d3.select("#min-year").on("input", updateCharts);
d3.select("#max-year").on("input", updateCharts);

const choroplethContainer = d3.select("#choropleth-container");
const linechartContainer = d3.select("#linechart-container");
const treemapContainer = d3.select("#treemap-container");
const stackedContainer = d3.select("#stacked-container");
const rankingsContainer = d3.select("#ranking-container");

window.driverData = null;
window.minYear = 2001;
window.maxYear = 2023;
window.selectedCountry = "Global";
window.selectedDriver = null;

document.getElementById('reset-filter').addEventListener('click', function () {
    document.getElementById('min-year').value = 2001;
    document.getElementById('max-year').value = 2023;
    selectedCountry = "Global";
    selectedDriver = null;
    updateCharts();
    updateSelected();
});

loadData();

// UTILITIES
function getDominantDriverColor(driver) {
    const driverColors = {
        "wildfire": "#F96666",
        "shifting agriculture": "#829460",
        "commodity": "#FFC107",
        "urbanization": "#A6CDC6",
        "forestry": "#674747"
    };
    return driverColors[driver] || "#ccc";
}

async function loadData() {
    const driverData = await d3.csv("country_driver_final2.csv");
    window.driverData = driverData;
    updateCharts();
}

function updateCharts() {
    window.minYear = +d3.select("#min-year").property("value");
    window.maxYear = +d3.select("#max-year").property("value");

    d3.selectAll(".tooltip").remove();

    createChoropleth(driverData, minYear, maxYear);
    createLineChart(driverData, minYear, maxYear);
    createTreemap(driverData, minYear, maxYear);
    createStackedBarChart(driverData, minYear, maxYear);
    createRankingChart(driverData, minYear, maxYear);
}

function positionTooltip(event, tooltip) {
    const tooltipWidth = tooltip.node().offsetWidth;
    const tooltipHeight = tooltip.node().offsetHeight;
    const pageWidth = window.innerWidth;
    const pageHeight = window.innerHeight;

    let left = event.pageX + 10;
    let top = event.pageY - 20;

    if (left + tooltipWidth > pageWidth) {
        left = event.pageX - tooltipWidth - 10;
    }

    if (top + tooltipHeight > pageHeight) {
        top = event.pageY - tooltipHeight - 10;
    }

    tooltip.style("left", left + "px")
        .style("top", top + "px");
}

function convertUnit(n) {
    const formatNumber = d3.format(",.1f");
    if (Math.abs(n) >= 1000000000) {
        return formatNumber(n / 1000000000) + " Gha";
    }
    else if (Math.abs(n) >= 1000000) {
        return formatNumber(n / 1000000) + " Mha";
    }
    else if (Math.abs(n) >= 1000) {
        return formatNumber(n / 1000) + " Kha";
    }
    else {
        return formatNumber(n) + " ha";
    }
}

function getPrimaryDriver(country) {
    const countryData = driverData.filter(d => d.country === country);
    let primaryDriver = "All";
    if (countryData.length > 0) {
        const driverLosses = {};
        countryData.forEach(item => {
            const driver = item.driver;
            let totalLossForDriver = 0;
            for (const yearKey in item) {
                if (yearKey.startsWith("tc_loss_ha_")) {
                    const year = +yearKey.replace("tc_loss_ha_", "");
                    if (year >= window.minYear && year <= window.maxYear) {
                        totalLossForDriver += +item[yearKey] || 0;
                    }
                }
            }
            driverLosses[driver] = (driverLosses[driver] || 0) + totalLossForDriver;
        });
        primaryDriver = Object.keys(driverLosses).reduce((a, b) => driverLosses[a] > driverLosses[b] ? a : b);
    }
    console.log(primaryDriver);
    return primaryDriver;
}

function updateSelected() {
    const primaryDriver = getPrimaryDriver(selectedCountry);
    d3.select("#selected-country").html(`Country: <strong><span style="color: ${primaryDriver ? getDominantDriverColor(primaryDriver) : "black"}">${selectedCountry}</strong></span>`);
    d3.select("#selected-driver").html(`Driver: <strong><span style="color: ${selectedDriver ? getDominantDriverColor(selectedDriver) : "black"}"> ${selectedDriver || "All"}</strong></span>`);
}

// CHART FUNCTIONS

function createChoropleth(data) {
    const width = 850, height = 500;
    updateSelected();
    d3.select("#choropleth-map").remove();
    choroplethContainer.select(".chart-heading").remove();
    const svg = choroplethContainer.append("svg")
        .attr("id", "choropleth-map")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", "0 0 850 500")
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("background", "#f9f9f9");

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("border", "1px solid #ccc")
        .style("padding", "10px")
        .style("display", "none");

    d3.json("world.json").then(geoData => {
        const projection = d3.geoMercator()
            .scale(140)
            .translate([width / 2, height / 1.5]);
        const path = d3.geoPath().projection(projection);

        svg.selectAll(".country")
            .data(geoData.features)
            .enter().append("path")
            .attr("class", "country")
            .attr("d", path)
            .attr("fill", "#ccc")
            .transition()
            .duration(1000)
            .attr("fill", d => {
                const countryData = data.filter(c => c.country === d.properties.name);
                if (!countryData) return "#ccc";

                if (countryData.length === 0) return "#ccc";

                let dominantDriver = null;
                let maxLoss = 0;

                const driverLosses = {};


                countryData.forEach(item => {
                    const driver = item.driver;
                    let totalLossForDriver = 0;
                    for (const yearKey in item) {
                        if (yearKey.startsWith("tc_loss_ha_")) {
                            const year = +yearKey.replace("tc_loss_ha_", "");
                            if (year >= window.minYear && year <= window.maxYear) {
                                totalLossForDriver += +item[yearKey] || 0;
                            }
                        }
                    }
                    driverLosses[driver] = totalLossForDriver;

                    if (totalLossForDriver > maxLoss) {
                        maxLoss = totalLossForDriver;
                        dominantDriver = driver;
                    }
                });

                return getDominantDriverColor(dominantDriver);
            });

        svg.selectAll(".country")
            .on("click", function (event, d) {
                event.stopPropagation();
                selectedCountry = d.properties.name;
                tooltip.style("display", "none");
                updateCharts();
                updateSelected();
            })
            .on("mouseover", function (event, d) {
                d3.select(this).attr("stroke", "yellow").attr("stroke-width", 2);
                const countryName = d.properties.name;
                const countryData = data.filter(item => item.country === countryName);

                if (countryData.length > 0) {
                    let tooltipHtml = `<strong><span style="color: ${getDominantDriverColor(getPrimaryDriver(countryName))}">${countryName}</span></strong><br>`;

                    const driverLosses = {};
                    countryData.forEach(item => {
                        const driver = item.driver;
                        let totalLossForDriver = 0;
                        for (const yearKey in item) {
                            if (yearKey.startsWith("tc_loss_ha_")) {
                                const year = +yearKey.replace("tc_loss_ha_", "");
                                if (year >= minYear && year <= maxYear) {
                                    totalLossForDriver += +item[yearKey] || 0;
                                }
                            }
                        }
                        driverLosses[driver] = totalLossForDriver;
                    });

                    const sortedDrivers = Object.entries(driverLosses).sort((a, b) => b[1] - a[1]);

                    sortedDrivers.forEach(([driver, loss]) => {
                        tooltipHtml += `<strong style="color:${getDominantDriverColor(driver)}">${driver}:</strong> ${convertUnit(loss)}<br>`;
                    });

                    tooltip.style("display", "block")
                        .html(tooltipHtml);
                }
            })
            .on("mousemove", function (event) {
                positionTooltip(event, tooltip);
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke", null).attr("stroke-width", null);
                tooltip.style("display", "none");
            });

        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(20, ${height - 120})`);

        const drivers = ["wildfire", "shifting agriculture", "commodity", "urbanization", "forestry"];
        const legendItemHeight = 20;

        legend.selectAll(".legend-item")
            .data(drivers)
            .enter().append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * legendItemHeight})`)
            .each(function (d) {
                const legendItem = d3.select(this);
                legendItem.append("rect")
                    .attr("width", 18)
                    .attr("height", 18)
                    .attr("fill", getDominantDriverColor(d));

                legendItem.append("text")
                    .attr("x", 24)
                    .attr("y", 9)
                    .attr("dy", "0.35em")
                    .text(d);
            });
    });
    const headingContainer = choroplethContainer.select(".chart-heading-container");
    const heading = headingContainer.append("h2")
        .text("Primary Loss Driver by Country")
        .attr("class", "chart-heading");
}

function createLineChart(data) {
    const width = 750, height = 300;

    d3.select("#line-chart").remove();
    linechartContainer.select(".chart-heading").remove();
    const svg = linechartContainer.append("svg")
        .attr("id", "line-chart")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", "-5 0 750 300")
        .attr("preserveAspectRatio", "xMidYMid meet");
    const countryData = data.filter(d => d.country === selectedCountry);
    const years = Object.keys(data[0]).filter(d => d.startsWith("tc_loss_ha_"));
    const parsedData = years.map(year => {
        return {
            year: +year.replace("tc_loss_ha_", ""),
            loss: d3.sum(countryData, d => +d[year]),
            drivers: countryData.map(d => ({ driver: d.driver, loss: +d[year] })).sort((a, b) => b.loss - a.loss)
        };
    }).filter(d => d.year >= window.minYear && d.year <= window.maxYear);

    const minLoss = d3.min(parsedData, d => selectedDriver ? d.drivers.find(driver => driver.driver === selectedDriver)?.loss || 0 : d.loss);
    const yDomainMin = minLoss * 0.9;
    const maxLoss = d3.max(parsedData, d => selectedDriver ? d.drivers.find(driver => driver.driver === selectedDriver)?.loss || 0 : d.loss);
    const yDomainMax = maxLoss * 1.1;
    const x = d3.scaleLinear().domain([window.minYear - 1, window.maxYear + 1]).range([60, width - 20]);
    const y = d3.scaleLinear().domain([yDomainMin, yDomainMax]).range([height - 20, 20]);

    const xAxis = d3.axisBottom(x).tickFormat(d3.format("d"));
    const yAxis = d3.axisLeft(y).ticks(5).tickFormat(d => convertUnit(d));

    svg.append("g")
        .attr("transform", `translate(0,${height - 20})`)
        .call(xAxis);

    svg.append("g")
        .attr("transform", `translate(60,0)`)
        .call(yAxis)
        .selectAll("text")
        .style("font-size", "12px");

    svg.selectAll(".grid-line")
        .data(y.ticks(5))
        .enter().append("line")
        .attr("class", "grid-line")
        .attr("x1", 60)
        .attr("x2", width - 20)
        .attr("y1", d => y(d))
        .attr("y2", d => y(d))
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 2");

    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(selectedDriver ? d.drivers.find(driver => driver.driver === selectedDriver)?.loss || 0 : d.loss));

    svg.append("path")
        .datum(parsedData)
        .attr("fill", "none")
        .attr("stroke", "#997C70")
        .attr("stroke-width", 3)
        .attr("d", line)
        .attr("stroke-dasharray", function () { return this.getTotalLength(); })
        .attr("stroke-dashoffset", function () { return this.getTotalLength(); })
        .transition()
        .duration(2000)
        .attr("stroke-dashoffset", 0);

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("border", "1px solid #ccc")
        .style("padding", "10px")
        .style("display", "none");

    svg.selectAll(".dot")
        .data(parsedData)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(selectedDriver ? d.drivers.find(driver => driver.driver === selectedDriver)?.loss || 0 : d.loss))
        .attr("r", 5)
        .attr("fill", "#8EB486")
        .on("mouseover", function (event, d) {
            const minYearData = parsedData.find(data => data.year === window.minYear);
            const loss = selectedDriver ? d.drivers.find(driver => driver.driver === selectedDriver)?.loss || 0 : d.loss;
            const percentChange = minYearData ? ((loss - (selectedDriver ? minYearData.drivers.find(driver => driver.driver === selectedDriver)?.loss || 0 : minYearData.loss)) /
                (selectedDriver ? minYearData.drivers.find(driver => driver.driver === selectedDriver)?.loss || 0 : minYearData.loss)) * 100 : 0;
            tooltip.style("display", "block")
                .html(`<strong>${d.year}</strong><br><span style="color:#B82132"><strong>Total Loss:</strong> </span>${convertUnit(loss)}<br><strong>% Change from ${window.minYear}:</strong> ${d3.format(".2f")(percentChange)}%<br>`);
            d3.select(this).attr("fill", "yellow");
        })

        .on("mousemove", function (event) {
            positionTooltip(event, tooltip);
        })
        .on("mouseout", function () {
            tooltip.style("display", "none");
            d3.select(this).attr("fill", "#8EB486");
        })
        .attr("opacity", 0)
        .transition()
        .duration(1000)
        .delay((d, i) => i * 100)
        .attr("opacity", 1);

    const headingContainer = linechartContainer.select(".chart-heading-container");
    const heading = headingContainer.append("h2")
        .html(selectedDriver ? `<span style="color:${getDominantDriverColor(getPrimaryDriver(selectedCountry))}">${selectedCountry}</span> Loss by Year (<span style="color:${getDominantDriverColor(selectedDriver)}">${selectedDriver}</span>)` :
            `<span style="color:${getDominantDriverColor(getPrimaryDriver(selectedCountry))}">${selectedCountry}</span> Loss by Year`)
        .attr("class", "chart-heading");
}

function createTreemap(data) {
    const width = 600, height = 300;

    d3.select("#treemap").remove();
    treemapContainer.select(".chart-heading").remove();
    const svg = treemapContainer.append("svg")
        .attr("id", "treemap")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", "0 0 600 300")
        .attr("preserveAspectRatio", "xMidYMid meet");
    const countryData = data.filter(d => d.country === selectedCountry);
    const filteredData = countryData.map(d => {
        const filteredLoss = Object.keys(d)
            .filter(key => key.startsWith("tc_loss_ha_"))
            .filter(key => {
                const year = +key.replace("tc_loss_ha_", "");
                return year >= window.minYear && year <= window.maxYear;
            })
            .reduce((sum, key) => sum + +d[key], 0);
        return { driver: d.driver, loss: filteredLoss };
    });

    const groupedData = d3.rollups(filteredData, v => d3.sum(v, d => d.loss), d => d.driver);
    const root = d3.hierarchy({ children: groupedData.map(([key, value]) => ({ name: key, value })) })
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);

    const treemapLayout = d3.treemap()
        .size([width, height])
        .padding(2);

    treemapLayout(root);
    const tiles = svg.selectAll(".tile")
        .data(root.leaves())
        .enter().append("g")
        .attr("class", "tile")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    tiles.append("rect")
        .attr("width", 0)
        .attr("height", 0)
        .attr("fill", d => getDominantDriverColor(d.data.name))
        .on("click", function (event, d) {
            selectedDriver = d.data.name;
            updateCharts();
            updateSelected();
        })
        .transition()
        .duration(1000)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0);

    tiles.filter(d => (d.x1 - d.x0) > 35 && (d.y1 - d.y0) > 25)
        .append("text")
        .attr("x", 3)
        .attr("y", 13)
        .attr("opacity", 0)
        .text(d => d.data.name)
        .attr("font-size", "10px")
        .attr("fill", "white")
        .transition()
        .duration(1000)
        .attr("opacity", 1);

    tiles.filter(d => (d.x1 - d.x0) > 50 && (d.y1 - d.y0) > 35)
        .append("text")
        .attr("x", 3)
        .attr("y", 25)
        .attr("opacity", 0)
        .text(d => {
            const totalLoss = d3.sum(countryData, d => {
                return Object.keys(d).filter(key => key.startsWith("tc_loss_ha_") && +key.replace("tc_loss_ha_", "") >= window.minYear && +key.replace("tc_loss_ha_", "") <= window.maxYear).reduce((sum, key) => sum + +d[key], 0);
            });
            const lossPercent = (d.value / totalLoss) * 100;
            return `${d3.format(".2f")(lossPercent)}%`;
        })
        .attr("font-size", "10px")
        .attr("fill", "white")
        .transition()
        .duration(1000)
        .attr("opacity", 1);
    
    tiles.filter(d => (d.x1 - d.x0) > 65 && (d.y1 - d.y0) > 45)
        .append("text")
        .attr("x", 3)
        .attr("y", 35)
        .attr("opacity", 0)
        .text(d => convertUnit(d.value))
        .attr("font-size", "10px")
        .attr("fill", "white")
        .transition()
        .duration(1000)
        .attr("opacity", 1);

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("border", "1px solid #ccc")
        .style("padding", "10px")
        .style("display", "none");

    tiles.on("mouseover", function (event, d) {
        const totalLoss = d3.sum(countryData, d => {
            return Object.keys(d).filter(key => key.startsWith("tc_loss_ha_") && +key.replace("tc_loss_ha_", "") >= window.minYear && +key.replace("tc_loss_ha_", "") <= window.maxYear).reduce((sum, key) => sum + +d[key], 0);
        });
        const lossPercent = (d.value / totalLoss) * 100;
        tooltip.style("display", "block")
            .html(`<strong><span style="color:${getDominantDriverColor(d.data.name)}">${d.data.name}</span></strong><br><span style="color:#B82132"><strong>Loss:</strong></span> ${convertUnit(d.value)}<br><strong>% of Total:</strong> ${d3.format(".2f")(lossPercent)}%`);
        d3.select(this).select("rect").attr("stroke", "yellow").attr("stroke-width", 2);
    })
        .on("mousemove", function (event) {
            positionTooltip(event, tooltip);
        })
        .on("mouseout", function () {
            tooltip.style("display", "none");
            d3.select(this).select("rect").attr("stroke", null).attr("stroke-width", null);
        });
    const headingContainer = treemapContainer.select(".chart-heading-container");
    const heading = headingContainer.append("h2")
        .html(`<span style="color:${getDominantDriverColor(getPrimaryDriver(selectedCountry))}">${selectedCountry}</span> Loss by Driver`)
        .attr("class", "chart-heading");
}

function createStackedBarChart(data) {
    const width = 750, height = 300;

    d3.select("#stacked-bar-chart").remove();
    stackedContainer.select(".chart-heading").remove();
    const svg = stackedContainer.append("svg")
        .attr("id", "stacked-bar-chart")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", "-10 0 750 300")
        .attr("preserveAspectRatio", "xMidYMid meet");

    const years = Object.keys(data[0]).filter(d => d.startsWith("tc_loss_ha_")).map(d => +d.replace("tc_loss_ha_", ""));
    const filteredData = data.filter(d => d.country === selectedCountry);
    const filteredYears = years.filter(year => year >= window.minYear && year <= window.maxYear);
    const stackedData = filteredYears.map(year => {
        const yearData = filteredData.map(d => ({ driver: d.driver, loss: +d[`tc_loss_ha_${year}`] }));
        let topDriverData = null;
        if (selectedDriver) {
            topDriverData = yearData.find(d => d.driver === selectedDriver);
        } else {
            topDriverData = yearData.reduce((max, d) => d.loss > max.loss ? d : max, { loss: 0 });
        }
        const otherLoss = d3.sum(yearData.filter(d => d.driver !== topDriverData.driver), d => d.loss);
        return {
            year,
            topDriver: topDriverData.loss,
            topDriverName: topDriverData.driver,
            other: otherLoss
        };
    });

    const x = d3.scaleBand().domain(filteredYears).range([60, width - 20]).padding(0.1);
    const y = d3.scaleLinear().domain([0, d3.max(stackedData, d => d.topDriver + d.other)]).range([height - 20, 20]);

    const color = d3.scaleOrdinal().domain(["topDriver", "other"]).range(["#324894", "#799351"]);

    const xAxis = d3.axisBottom(x).tickFormat(d3.format("d"));
    const yAxis = d3.axisLeft(y).ticks(5).tickFormat(d => convertUnit(d));

    svg.append("g")
        .attr("transform", `translate(0,${height - 20})`)
        .call(xAxis);

    svg.append("g")
        .attr("transform", `translate(60,0)`)
        .call(yAxis)
        .style("font-size", "12px");

    svg.selectAll(".grid-line")
        .data(y.ticks(5))
        .enter().append("line")
        .attr("class", "grid-line")
        .attr("x1", 60)
        .attr("x2", width - 20)
        .attr("y1", d => y(d))
        .attr("y2", d => y(d))
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 2");

    svg.selectAll(".bar-topDriver")
        .data(stackedData)
        .enter().append("rect")
        .attr("class", "bar-topDriver")
        .attr("x", d => x(d.year))
        .attr("y", d => y(0))
        .attr("height", 0)
        .attr("width", x.bandwidth())
        .attr("fill", d => getDominantDriverColor(d.topDriverName))
        .transition()
        .duration(1000)
        .attr("y", d => y(d.topDriver + d.other))
        .attr("height", d => y(0) - y(d.topDriver))
        .each(function (d) {
        });

    svg.selectAll(".bar-other")
        .data(stackedData)
        .enter().append("rect")
        .attr("class", "bar-other")
        .attr("x", d => x(d.year))
        .attr("y", d => y(0))
        .attr("height", 0)
        .attr("width", x.bandwidth())
        .attr("fill", "#ccc")
        .transition()
        .duration(1000)
        .attr("y", d => y(d.other))
        .attr("height", d => y(0) - y(d.other));

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("border", "1px solid #ccc")
        .style("padding", "10px")
        .style("display", "none");

    svg.selectAll(".bar-topDriver, .bar-other")
        .on("mouseover", function (event, d) {
            tooltip.style("display", "block")
                .html(`<strong>${d.year}</strong><br><strong><span style="color:${getDominantDriverColor(d.topDriverName)}"> Driver: </span></strong>${d.topDriverName}<br><strong><span style="color:#B82132">Driver Loss: </span></strong>${convertUnit(d.topDriver)} (${d3.format(".2f")((d.topDriver / (d.topDriver + d.other)) * 100)}%)<br><strong><span style="color:#ccc">Other Loss:</span></strong> ${convertUnit(d.other)} (${d3.format(".2f")((d.other / (d.topDriver + d.other)) * 100)}%)`);
            d3.select(this).attr("stroke", "yellow").attr("stroke-width", 2);
        })
        .on("mousemove", function (event) {
            positionTooltip(event, tooltip);
        })
        .on("mouseout", function () {
            tooltip.style("display", "none");
            d3.select(this).attr("stroke", null).attr("stroke-width", null);
        });

    const headingContainer = stackedContainer.select(".chart-heading-container");
    const heading = headingContainer.append("h2")
        .html(selectedDriver ? `<span style="color:${getDominantDriverColor(getPrimaryDriver(selectedCountry))}"> ${selectedCountry}</span> Loss by Year (<span style = "color:${getDominantDriverColor(selectedDriver)}">${selectedDriver}</span> vs Other Drivers)` : `<span style="color:${getDominantDriverColor(getPrimaryDriver(selectedCountry))}"> ${selectedCountry}</span> Loss by Year (Top Driver vs Other Drivers)`)
        .attr("class", "chart-heading");
}

function createRankingChart(data) {
    const width = 750, height = 300;

    d3.select("#ranking-chart").remove();
    rankingsContainer.select(".chart-heading").remove();
    const svg = rankingsContainer.append("svg")
        .attr("id", "ranking-chart")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", "0 0 750 300")
        .attr("preserveAspectRatio", "xMidYMid meet");

    const filteredData = data
        .filter(d => d.country !== "Global");

    const countryLosses = {};
    filteredData.forEach(d => {
        if (!countryLosses[d.country]) {
            countryLosses[d.country] = 0;
        }
        for (const key in d) {
            if (key.startsWith("tc_loss_ha_")) {
                const year = +key.replace("tc_loss_ha_", "");
                if (year >= window.minYear && year <= window.maxYear) {
                    countryLosses[d.country] += +d[key] || 0;
                }
            }
        }
    });

    const aggregatedData = Object.entries(countryLosses).map(([country, totalLoss]) => ({
        country,
        totalLoss,
        driverLoss: selectedDriver ? filteredData.filter(item => item.country === country && item.driver === selectedDriver).reduce((sum, d) => {
            for (const key in d) {
                if (key.startsWith("tc_loss_ha_")) {
                    const year = +key.replace("tc_loss_ha_", "");
                    if (year >= window.minYear && year <= window.maxYear) {
                        sum += +d[key] || 0;
                    }
                }
            }
            return sum;
        }, 0) : totalLoss // If no driver selected, use the total loss
    }));

    const sortedData = aggregatedData.sort((a, b) => b.driverLoss - a.driverLoss).slice(0, 5);
    console.log(aggregatedData.sort((a, b) => b.driverLoss - a.driverLoss))

    if (selectedCountry !== "Global" && !sortedData.some(d => d.country === selectedCountry)) {
        const selectedCountryData = aggregatedData.find(d => d.country === selectedCountry);
        if (selectedCountryData) {
            sortedData.push(selectedCountryData);
        }
    }

    const x = d3.scaleLinear().domain([0, d3.max(sortedData, d => d.driverLoss)]).range([60, width - 20]);
    const y = d3.scaleBand().domain(sortedData.map(d => d.country.length > 9 ? d.country.slice(0, 6) + '...' : d.country)).range([20, height - 20]).padding(0.1);

    const xAxis = d3.axisTop(x).tickFormat(d => convertUnit(d));
    const yAxis = d3.axisLeft(y);

    svg.append("g")
        .attr("transform", `translate(0,20)`)
        .call(xAxis)
        .style("font-size", "12px");

    svg.append("g")
        .attr("transform", `translate(60,0)`)
        .call(yAxis)
        .style("font-size", "12px");

    svg.selectAll(".bar")
        .data(sortedData)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", 60)
        .attr("y", d => y(d.country.length > 9 ? d.country.slice(0, 6) + '...' : d.country))
        .attr("width", 0)
        .attr("height", y.bandwidth())
        .attr("fill", d => d.country === selectedCountry ? "#B82132" : selectedDriver ? getDominantDriverColor(selectedDriver) : "#8EB486")
        .transition()
        .duration(1000)
        .attr("width", d => x(d.driverLoss) - 60);

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("border", "1px solid #ccc")
        .style("padding", "10px")
        .style("display", "none");

    svg.selectAll(".bar")
        .on("mouseover", function (event, d) {
            const globalRank = aggregatedData.sort((a, b) => b.driverLoss - a.driverLoss).findIndex(item => item.country === d.country) + 1;
            tooltip.style("display", "block")
                .html(`<strong><span style="color: ${getDominantDriverColor(getPrimaryDriver(d.country))}">${d.country}</span></strong><br><strong><span style="color:#B82132">Total Loss:</strong></span> ${convertUnit(d.driverLoss)}<br><span style="color:#B82132"><strong>% of Global Loss:</strong></span> ${d3.format(".2f")((d.driverLoss / d3.sum(aggregatedData, d => d.driverLoss)) * 100)}%<br><strong>Global Rank:</strong> ${globalRank}`);

            d3.select(this).attr("stroke", "yellow").attr("stroke-width", 2);
        })
        .on("mousemove", function (event) {
            positionTooltip(event, tooltip);
        })
        .on("mouseout", function () {
            tooltip.style("display", "none");
            d3.select(this).attr("stroke", null).attr("stroke-width", null);
        });

    const headingContainer = rankingsContainer.select(".chart-heading-container");
    const heading = headingContainer.append("h2")
        .html(selectedDriver ? `Top Countries by Loss (<span style= "color:${getDominantDriverColor(selectedDriver)}">${selectedDriver}</span>)` : "Top Countries by Loss")
        .attr("class", "chart-heading");
}
