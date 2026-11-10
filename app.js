// Weather requests go through the same-origin server endpoint (server.js),
// which adds the OpenWeatherMap API key on the server. No key in the browser.
const apiurl = "/api/weather?q=";
const searchbox=document.querySelector(".sea input")
const weatherbutton=document.querySelector(".sea button")
const weathericon=document.querySelector(".weather-icon")

function showweathererror(message){
    document.querySelector(".hide").style.display="none"
    alert(message)
}

async function checkweather(city){
    let data;
    try {
        const response= await fetch(apiurl+encodeURIComponent(city));
        if (!response.ok) {
            showweathererror("Could not find weather for that city. Please check the name and try again.");
            return;
        }
        data = await response.json();
    } catch (err) {
        showweathererror("Unable to load weather data right now. Please try again later.");
        return;
    }

    if (!data || !data.main || !data.wind || !Array.isArray(data.weather) || data.weather.length === 0 || !data.weather[0]) {
        showweathererror("Received incomplete weather data. Please try again.");
        return;
    }

    document.querySelector(".city").textContent = data.name;
    document.querySelector(".temp").textContent = Math.round(data.main.temp) + "°c";
    document.querySelector(".text").textContent = data.main.humidity + "%";
    document.querySelector(".text2").textContent = data.wind.speed + "km/hr";


if(data.weather[0].main=="Mist"){
  weathericon.src= "image/mist.png"
}
else if (data.weather[0].main=="Clear"){
    weathericon.src="image/clear.png"
}
else if (data.weather[0].main=="Clouds"){
 weathericon.src="image/weather.png"
}
else if (data.weather[0].main=="Drizzle"){
    weathericon.src="image/drizzle.png"
   }

   else if (data.weather[0].main=="Rain"){
    weathericon.src="image/rain.png"
   } 
   else if (data.weather[0].main=="Haze"){
    weathericon.src="image/haze.png"
   }
   else if (data.weather[0].main=="Smoke"){
    weathericon.src="image/Smoke.png"
   }

   document.querySelector(".hide").style.display="block"
   document.querySelector(".container").style.backdropFilter="blur(5px)"
}
weatherbutton.addEventListener("click", ()=>{
    checkweather(searchbox.value)
})



