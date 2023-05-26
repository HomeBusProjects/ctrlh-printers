# PDX Hackerspace 3D Printer Dashboard

This is a simple web page driven by Javascript which displays the status of 3D printers at [PDX Hackerspace](https://pdxhackerspace.org).

The page uses [Homebus](https://homebus.org) to transfer data.

On the backend each printer has one instance of [homebus-octoprint](https://github.com/HomeBusProjects/homebus-octoprint) which polls the printers' status once per minute and publishes the status to the Homebus broker. The dashboard subscribes to this data feed and displays it.

The backend also uses [homebus-image-publisher](https://github.com/HomeBusProjects/homebus-image-publisher) to grab stills from the printers' cams and publish them.

Homebus is currently in a pre-alpha state and is not yet ready for users not involved in the project.
