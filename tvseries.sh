function encode {
	echo "Importing disk $1 (track $3) to $2"
	HandBrakeCLI \
	-i "$1" \
	-o "$2" \
	-t$3 \
	-a1,3 \
	-m \
	--loose-anamorphic \
	-ex264 \
	--x264-tune=film \
	-q20.0 \
	-r30 \
	--pfr \
	-x b-adapt=2:psnr=0:ssim=0 \
	-X1920 \
	-Eca_aac,ca_aac \
	-5
}

function getDVDPath {
	input=`mount | egrep -e /dev/disk[12] | cut -f3 -d" "`
}

getDVDPath
while [ ! -n "$input" ]
do
	sleep 1
	getDVDPath
done

output=/Users/jon/Movies/TV\ Shows/
title=$1
episode_offset=$3
season=$2

# import disk
for ((i=1; i<=$4; i++))
do
	episode=$(($episode_offset + $i - 1))
	track=$(($i))
	mkdir -p "$output$title/Season $season/"
	encode $input "$output$title/Season $season/$title.S$season.E$episode.mp4" $track
done

# eject disk
sleep 1
diskutil eject /dev/disk1
