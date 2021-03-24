wget -nc http://glyphwiki.org/dump.tar.gz
rm -rf glyphwiki_dump && mkdir -p glyphwiki_dump
tar -xf dump.tar.gz --directory glyphwiki_dump
sed 's/\\@/\@/g' glyphwiki_dump/dump_all_versions.txt > glyphwiki_dump/dump_all_versions_noescape.txt