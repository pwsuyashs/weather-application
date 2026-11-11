const apiurl = "https://api.openweathermap.org/data/2.5/weather?units=metric&q=";
const apikey="74dda9ad8a132d1dafbaa57f9b359f33";
const searchbox=document.querySelector(".sea input")
const weatherbutton=document.querySelector(".sea button")
const weathericon=document.querySelector(".weather-icon")

function showweathererror(message){
    const errorbox = document.querySelector(".error");
    if (errorbox) {
        errorbox.textContent = message;
        errorbox.style.display = "block";
    }
    document.querySelector(".hide").style.display = "none";
}

async function checkweather(city){
    try {
        const requesturl = new URL(apiurl);
        requesturl.searchParams.set("q", city);
        requesturl.searchParams.set("appid", apikey);
        const response = await fetch(requesturl);
        var data = await response.json();

        if (!response.ok) {
            showweathererror(response.status === 404 ? "City not found" : "Unable to fetch weather data");
            return;
        }
        if (!data || !data.main || !data.wind || !Array.isArray(data.weather) || !data.weather[0]) {
            showweathererror("Unable to fetch weather data");
            return;
        }

        const errorbox = document.querySelector(".error");
        if (errorbox) {
            errorbox.style.display = "none";
        }

        document.querySelector(".city").textContent = data.name;
        document.querySelector(".temp").textContent = Math.round(data.main.temp) + "°c";
        document.querySelector(".text").textContent = data.main.humidity + "%";
        document.querySelector(".text2").textContent = data.wind.speed + "km/hr";

        const condition = data.weather[0].main;

        if(condition=="Mist"){
          weathericon.src= "image/mist.png"
        }
        else if (condition=="Clear"){
            weathericon.src="image/clear.png"
        }
        else if (condition=="Clouds"){
         weathericon.src="image/weather.png"
        }
        else if (condition=="Drizzle"){
            weathericon.src="image/drizzle.png"
        }
        else if (condition=="Rain"){
            weathericon.src="image/rain.png"
        }
        else if (condition=="Haze"){
            weathericon.src="image/haze.png"
        }
        else if (condition=="Smoke"){
            weathericon.src="image/Smoke.png"
        }

        document.querySelector(".hide").style.display="block"
        document.querySelector(".container").style.backdropFilter="blur(5px)"
    } catch (err) {
        showweathererror("Unable to fetch weather data");
    }
}
weatherbutton.addEventListener("click", ()=>{
    checkweather(searchbox.value)
})



