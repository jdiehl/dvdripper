# HandBrake Commands

Scan:

    HandBrakeCLI \
      -i/Volumes/DVD/ \
      --main-feature \
      --scan

Rip:

    HandBrakeCLI \
      -i/Volumes/DVD -t1 -a1,2 \
      -DVD.m4v \
      -w1920 -b2048 \
      -B256 -R48 -66ch

HandBrakeCLI -i/Volumes/STARSHIP_TROOPERS/ -o"Starship Troopers.mp4" --main-feature -a1,2 --preset="AppleTV 3" -Ecopy,copy