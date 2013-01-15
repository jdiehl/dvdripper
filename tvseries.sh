function encode {
	echo "Importing disk $1 (track $3) to $2"
	HandBrakeCLI \
	-i "$1" \
	-o "$2" \
	-t$3 \
	-a1,2 \
	-m \
	--loose-anamorphic \
	-ex264 \
	--x264-tune=animation \
	-q21.0 \
	-r30 \
	--pfr \
	-x b-adapt=2 \
	-X1920 \
	-Eca_aac,ca_aac \
	-dslower
}

function getDVDPath {
	input=`mount | grep /dev/disk2 | cut -f3 -d" "`
}

getDVDPath
while [ ! -n "$input" ]
do
	sleep 1
	getDVDPath
done

output=/Users/jon/Movies/
title=$1
episode_offset=$3
season=$2

# import disk
for ((i=1; i<=$4; i++))
do
	episode=$(($episode_offset + $i - 1))
	mkdir -p "$output$title/Season $season/"
	encode $input "$output$title/Season $season/$title.S$season.E$episode.mp4" $i
done

# eject disk
sleep 1
diskutil eject /dev/disk2