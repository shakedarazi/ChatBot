# Strip Co-authored-by: use only the subject line (first line) as the new message
$subject = (git log -1 --pretty=%s)
git -c user.name="shaked_arazi" -c user.email="shaked13579@gmail.com" commit --amend --no-verify -m $subject --reset-author
