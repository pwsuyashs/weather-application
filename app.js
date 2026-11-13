const apiurl = "https://api.openweathermap.org/data/2.5/weather?units=metric&q=";
const apikey="74dda9ad8a132d1dafbaa57f9b359f33";
const searchbox=document.querySelector(".sea input")
const weatherbutton=document.querySelector(".sea button")
const weathericon=document.querySelector(".weather-icon")

async function checkweather(city){
    let response, data;
    try {
        response = await fetch(apiurl + encodeURIComponent(city) + `&appid=${apikey}`);
        data = await response.json();
    } catch (err) {
        document.querySelector(".hide").style.display = "none";
        alert("Unable to fetch weather data. Please try again.");
        return;
    }
    if (!response.ok || !data || !data.main || !data.wind || !Array.isArray(data.weather) || data.weather.length === 0) {
        document.querySelector(".hide").style.display = "none";
        alert("City not found. Please enter a valid city name.");
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



